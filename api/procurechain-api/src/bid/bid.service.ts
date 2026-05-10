import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BidStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PolicyService } from '../policy/policy.service';
import { PrismaService } from '../prisma/prisma.service';
import { RulesService } from '../rules/rules.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import type { BidStatusDto, EvaluateBidDto, RecommendBidDto, UpsertBidDto } from './bid.dto';

type Ctx = {
  tenantId: string;
  companyId: string;
  userId?: string;
  roles?: string[];
  actorType?: 'INTERNAL' | 'PARTNER';
  partnerId?: string;
  partnerUserId?: string;
};

function toJson(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

@Injectable()
export class BidService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rules: RulesService,
    private readonly policy: PolicyService,
    private readonly taxonomy: TaxonomyService,
  ) {}

  private readonly allowedTransitions: Record<BidStatus, BidStatus[]> = {
    DRAFT: ['SUBMITTED', 'CLOSED'],
    SUBMITTED: ['OPENED', 'UNDER_EVALUATION', 'REJECTED', 'CLOSED'],
    OPENED: ['UNDER_EVALUATION', 'REJECTED', 'CLOSED'],
    UNDER_EVALUATION: ['SHORTLISTED', 'REJECTED', 'AWARD_RECOMMENDED', 'CLOSED'],
    SHORTLISTED: ['AWARD_RECOMMENDED', 'REJECTED', 'CLOSED'],
    REJECTED: ['CLOSED'],
    AWARD_RECOMMENDED: ['CLOSED'],
    CLOSED: [],
  };

  private assertTransition(from: BidStatus, to: BidStatus) {
    const allowed = this.allowedTransitions[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(`Bid transition not allowed: ${from} -> ${to}`);
    }
  }

  private isSupplierCtx(ctx: any) {
    return ctx.actorType === 'PARTNER' && (ctx.roles ?? []).includes('SUPPLIER') && !!ctx.partnerId;
  }

  private requireSupplierId(ctx: any) {
    if (!this.isSupplierCtx(ctx)) return undefined;
    if (!ctx.partnerId) {
      throw new BadRequestException('Missing supplier partner context');
    }
    return ctx.partnerId as string;
  }

  private assertInternalOnly(ctx: any, action: string) {
    if (this.isSupplierCtx(ctx)) {
      throw new BadRequestException(`${action} is not available from the supplier portal`);
    }
  }

  private async getScoped(ctx: Ctx, id: string) {
    const supplierId = this.requireSupplierId(ctx);
    const bid = await this.prisma.bid.findFirst({
      where: {
        id,
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        ...(supplierId ? { supplierId } : {}),
      },
      include: {
        rfq: {
          include: {
            pr: {
              include: {
                lines: true,
              },
            },
          },
        },
        supplier: true,
        scores: true,
        lines: {
          include: {
            prLine: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!bid) throw new NotFoundException('Bid not found');
    return bid;
  }

  private async assertSupplierVerified(ctx: Ctx, supplierId: string) {
    const profile = await this.prisma.supplierOnboardingProfile.findUnique({
      where: { supplierId },
      select: {
        tenantId: true,
        companyId: true,
        verificationStatus: true,
      },
    });

    if (!profile || profile.tenantId !== ctx.tenantId || profile.companyId !== ctx.companyId) {
      throw new BadRequestException('Supplier onboarding profile is required before bid submission');
    }

    if (profile.verificationStatus !== 'VERIFIED') {
      throw new BadRequestException(
        `Supplier must be VERIFIED before submitting bids. Current status: ${profile.verificationStatus}`,
      );
    }
  }

  private async getSupplierEligibilityContext(ctx: Ctx, supplierId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: supplierId,
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        status: 'ACTIVE',
      },
      include: {
        tags: {
          select: {
            subcategoryId: true,
          },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return {
      supplierId: supplier.id,
      country: (supplier.country ?? '').toUpperCase(),
      tagIds: new Set(supplier.tags.map((tag) => tag.subcategoryId)),
    };
  }

  private isSupplierEligibleForRfq(
    rfq: {
      releaseMode: 'PRIVATE' | 'LOCAL' | 'GLOBAL' | 'PUBLIC';
      localCountryCode: string | null;
      suppliers: Array<{ supplierId: string }>;
      pr: { subcategoryId: string | null };
    },
    supplier: {
      supplierId: string;
      country: string;
      tagIds: Set<string>;
    },
  ) {
    if (rfq.releaseMode === 'PRIVATE') {
      return rfq.suppliers.some((entry) => entry.supplierId === supplier.supplierId);
    }

    const subcategoryId = rfq.pr.subcategoryId;
    if (!subcategoryId) {
      return false;
    }

    const canonicalId = this.taxonomy.normalizeAppendixCSubcategoryId(subcategoryId);
    const categoryIds = [subcategoryId, canonicalId];
    const hasCategoryAccess = categoryIds.some((categoryId) => supplier.tagIds.has(categoryId));
    if (!hasCategoryAccess) {
      return false;
    }

    if (rfq.releaseMode === 'LOCAL') {
      const rfqCountry = (rfq.localCountryCode ?? 'ZA').toUpperCase();
      return supplier.country === rfqCountry;
    }

    return rfq.releaseMode === 'GLOBAL' || rfq.releaseMode === 'PUBLIC';
  }

  private buildBidLineRecords(
    rfq: {
      id: string;
      pr: {
        currency: string;
        lines: Array<{
          id: string;
          description: string;
          quantity: number;
          uom: string | null;
          notes: string | null;
        }>;
      };
    },
    dto: UpsertBidDto,
  ) {
    if (!dto.lines?.length) {
      return {
        records: [] as Array<{
          prLineId: string;
          description: string;
          quantity: number;
          uom: string | null;
          unitPrice: Prisma.Decimal;
          lineTotal: Prisma.Decimal;
          notes: string | null;
        }>,
        computedTotal: dto.totalBidValue == null ? undefined : new Prisma.Decimal(dto.totalBidValue),
      };
    }

    const prLineMap = new Map(rfq.pr.lines.map((line) => [line.id, line]));
    const seen = new Set<string>();
    const records = dto.lines.map((line, index) => {
      const prLine = prLineMap.get(line.prLineId);
      if (!prLine) {
        throw new BadRequestException(`Bid line ${index + 1} does not match any RFQ line item`);
      }
      if (seen.has(line.prLineId)) {
        throw new BadRequestException(`Duplicate bid line detected for PR line ${line.prLineId}`);
      }
      seen.add(line.prLineId);

      const quantity = line.quantity ?? prLine.quantity;
      if (quantity <= 0) {
        throw new BadRequestException(`Bid line ${index + 1} quantity must be greater than zero`);
      }

      const unitPriceValue = line.unitPrice ?? (line.lineTotal != null ? line.lineTotal / quantity : undefined);
      if (unitPriceValue == null || unitPriceValue < 0) {
        throw new BadRequestException(`Bid line ${index + 1} unit price is required`);
      }

      const unitPrice = new Prisma.Decimal(unitPriceValue);
      const lineTotal = unitPrice.mul(quantity);

      return {
        prLineId: prLine.id,
        description: prLine.description,
        quantity,
        uom: prLine.uom,
        unitPrice,
        lineTotal,
        notes: line.notes?.trim() || null,
      };
    });

    const missingLineIds = rfq.pr.lines.filter((line) => !seen.has(line.id)).map((line) => line.id);
    if (missingLineIds.length > 0) {
      throw new BadRequestException('Supplier bid must include pricing for every RFQ line item');
    }

    const computedTotal = records.reduce((sum, line) => sum.add(line.lineTotal), new Prisma.Decimal(0));
    return { records, computedTotal };
  }

  private async assertRequiredSupplierFormsCompleted(ctx: Ctx, rfqId: string, supplierId: string) {
    const requiredAssignments = await this.prisma.rFQSupplierFormAssignment.findMany({
      where: {
        rfqId,
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        isRequired: true,
      },
      include: {
        template: true,
        responses: {
          where: { supplierId },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    });

    const missing = requiredAssignments
      .filter((assignment) => {
        const response = assignment.responses[0];
        return !response || response.isComplete !== true;
      })
      .map((assignment) => ({
        assignmentId: assignment.id,
        templateId: assignment.templateId,
        templateName: assignment.template.name,
      }));

    if (missing.length > 0) {
      throw new BadRequestException({
        message: 'Required supplier forms must be completed before bid submission',
        missingSupplierForms: missing,
      });
    }
  }

  async upsertDraft(ctx: Ctx, dto: UpsertBidDto) {
    const supplierId = this.requireSupplierId(ctx);
    const rfq = await this.prisma.rFQ.findFirst({
      where: { id: dto.rfqId, tenantId: ctx.tenantId, companyId: ctx.companyId },
      include: {
        pr: {
          include: {
            lines: true,
          },
        },
        suppliers: {
          select: {
            supplierId: true,
          },
        },
      },
    });
    if (!rfq) throw new NotFoundException('RFQ not found');
    if (!['RELEASED', 'OPEN'].includes(rfq.status)) {
      throw new BadRequestException('Bids can only be prepared while RFQ is RELEASED or OPEN');
    }

    if (supplierId && dto.supplierId !== supplierId) {
      throw new BadRequestException('supplierId does not match the authenticated supplier');
    }

    const link = await this.prisma.rFQSupplier.findFirst({
      where: { rfqId: rfq.id, supplierId: dto.supplierId },
    });
    if (!link) {
      const supplier = await this.getSupplierEligibilityContext(ctx, dto.supplierId);
      if (!this.isSupplierEligibleForRfq(rfq, supplier)) {
        throw new BadRequestException('Supplier is not eligible for this RFQ');
      }
    }

    const { records: bidLines, computedTotal } = this.buildBidLineRecords(rfq, dto);
    const totalBidValue = computedTotal;

    const existing = await this.prisma.bid.findFirst({
      where: {
        rfqId: rfq.id,
        supplierId: dto.supplierId,
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
      },
    });

    if (existing && existing.status !== 'DRAFT') {
      throw new BadRequestException(`Cannot edit bid unless status is DRAFT (current: ${existing.status})`);
    }

    const bid = await this.prisma.bid.upsert({
      where: {
        rfqId_supplierId: { rfqId: rfq.id, supplierId: dto.supplierId },
      },
      create: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        rfqId: rfq.id,
        supplierId: dto.supplierId,
        status: 'DRAFT',
        payload: toJson(dto.payload),
        documents: toJson(dto.documents),
        notes: dto.notes,
        currency: dto.currency ?? rfq.currency ?? rfq.pr.currency,
        totalBidValue,
      },
      update: {
        version: { increment: 1 },
        payload: toJson(dto.payload),
        documents: toJson(dto.documents),
        notes: dto.notes,
        currency: dto.currency ?? rfq.currency ?? rfq.pr.currency,
        totalBidValue,
      },
      include: {
        supplier: true,
        lines: true,
      },
    });

    if (dto.lines) {
      await this.prisma.bidLine.deleteMany({ where: { bidId: bid.id } });
      if (bidLines.length > 0) {
        await this.prisma.bidLine.createMany({
          data: bidLines.map((line) => ({
            bidId: bid.id,
            rfqId: rfq.id,
            prLineId: line.prLineId,
            description: line.description,
            quantity: line.quantity,
            uom: line.uom,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
            notes: line.notes,
          })),
        });
      }
    }

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: existing ? 'BID_DRAFT_UPDATED' : 'BID_DRAFT_CREATED',
      entityType: 'Bid',
      entityId: bid.id,
      payload: { rfqId: rfq.id, supplierId: dto.supplierId, version: bid.version },
    });

    return this.getScoped(ctx, bid.id);
  }

  async submit(ctx: Ctx, id: string) {
    const bid = await this.getScoped(ctx, id);
    this.assertTransition(bid.status, 'SUBMITTED');
    await this.assertSupplierVerified(ctx, bid.supplierId);
    await this.assertRequiredSupplierFormsCompleted(ctx, bid.rfqId, bid.supplierId);

    const subcategoryId = bid.rfq.pr.subcategoryId;
    if (!subcategoryId) {
      throw new BadRequestException('RFQ-linked PR missing subcategoryId');
    }

    const dynamicValidation = await this.rules.validatePayload('BID', {
      subcategoryId,
      country: 'ZA',
      payload: (bid.payload as Record<string, unknown>) ?? {},
    });
    if (!dynamicValidation.valid) {
      throw new BadRequestException({
        message: 'Dynamic field validation failed for BID',
        missingFields: dynamicValidation.missingFields,
        rulePackKey: dynamicValidation.rulePackKey,
      });
    }

    if (bid.rfq.pr.lines.length > 0 && bid.lines.length !== bid.rfq.pr.lines.length) {
      throw new BadRequestException('Bid must include line pricing for every RFQ line item before submission');
    }

    const lineTotal = bid.lines.reduce((sum, line) => sum.add(line.lineTotal), new Prisma.Decimal(0));

    const updated = await this.prisma.bid.update({
      where: { id: bid.id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        totalBidValue: bid.lines.length > 0 ? lineTotal : bid.totalBidValue,
      },
      include: { supplier: true, lines: true },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'BID_SUBMITTED',
      entityType: 'Bid',
      entityId: bid.id,
      payload: { rfqId: bid.rfqId, supplierId: bid.supplierId },
    });

    return updated;
  }

  async open(ctx: Ctx, id: string) {
    this.assertInternalOnly(ctx, 'Bid opening');
    const bid = await this.getScoped(ctx, id);
    this.assertTransition(bid.status, 'OPENED');

    const updated = await this.prisma.bid.update({
      where: { id: bid.id },
      data: { status: 'OPENED', openedAt: new Date() },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'BID_OPENED',
      entityType: 'Bid',
      entityId: bid.id,
      payload: {},
    });

    return updated;
  }

  async evaluate(ctx: Ctx, id: string, dto: EvaluateBidDto) {
    this.assertInternalOnly(ctx, 'Bid evaluation');
    await this.policy.assertActionAllowed(ctx, 'BID_EVALUATE');
    const bid = await this.getScoped(ctx, id);

    if (bid.status === 'SUBMITTED') {
      await this.prisma.bid.update({ where: { id: bid.id }, data: { status: 'UNDER_EVALUATION' } });
    }
    if (!['OPENED', 'UNDER_EVALUATION', 'SHORTLISTED'].includes(bid.status)) {
      throw new BadRequestException('Bid must be OPENED or UNDER_EVALUATION to be scored');
    }

    if (!dto.criteria?.length) {
      throw new BadRequestException('At least one criterion score is required');
    }

    const evaluatorId = ctx.userId ?? 'dev-user';
    for (const criterion of dto.criteria) {
      await this.prisma.bidScore.upsert({
        where: {
          bidId_evaluatorId_criterion: {
            bidId: bid.id,
            evaluatorId,
            criterion: criterion.criterion,
          },
        },
        create: {
          bidId: bid.id,
          evaluatorId,
          criterion: criterion.criterion,
          score: new Prisma.Decimal(criterion.score),
          weight: new Prisma.Decimal(criterion.weight ?? 25),
          notes: criterion.notes,
        },
        update: {
          score: new Prisma.Decimal(criterion.score),
          weight: new Prisma.Decimal(criterion.weight ?? 25),
          notes: criterion.notes,
        },
      });
    }

    const allScores = await this.prisma.bidScore.findMany({ where: { bidId: bid.id } });
    const weightedTotal = allScores.reduce((sum, s) => sum + Number(s.score) * Number(s.weight), 0);
    const weightSum = allScores.reduce((sum, s) => sum + Number(s.weight), 0);
    const finalScore = weightSum > 0 ? weightedTotal / weightSum : 0;

    const updated = await this.prisma.bid.update({
      where: { id: bid.id },
      data: {
        status: 'UNDER_EVALUATION',
        finalScore: new Prisma.Decimal(finalScore.toFixed(2)),
        evaluationSummary: {
          evaluatorCount: new Set(allScores.map((s) => s.evaluatorId)).size,
          criteriaCount: allScores.length,
          summary: dto.summary,
        },
      },
      include: { scores: true, supplier: true },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: evaluatorId,
      eventType: 'BID_EVALUATED',
      entityType: 'Bid',
      entityId: bid.id,
      payload: {
        criteria: dto.criteria,
        finalScore: Number(updated.finalScore ?? 0),
      },
    });

    return updated;
  }

  async recommend(ctx: Ctx, id: string, dto: RecommendBidDto) {
    this.assertInternalOnly(ctx, 'Bid recommendation');
    await this.policy.assertActionAllowed(ctx, 'BID_RECOMMEND');
    const bid = await this.getScoped(ctx, id);

    if (!['UNDER_EVALUATION', 'SHORTLISTED'].includes(bid.status)) {
      throw new BadRequestException('Bid must be evaluated before recommendation');
    }

    const updated = await this.prisma.bid.update({
      where: { id: bid.id },
      data: {
        status: 'AWARD_RECOMMENDED',
        recommended: true,
        recommendationReason: dto.reason.trim(),
      },
      include: { supplier: true, scores: true },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'BID_AWARD_RECOMMENDED',
      entityType: 'Bid',
      entityId: bid.id,
      payload: {
        reason: dto.reason,
        finalScore: Number(updated.finalScore ?? 0),
      },
    });

    return updated;
  }

  async transition(ctx: Ctx, id: string, dto: BidStatusDto) {
    this.assertInternalOnly(ctx, 'Bid transition');
    const bid = await this.getScoped(ctx, id);
    this.assertTransition(bid.status, dto.status);

    const updated = await this.prisma.bid.update({
      where: { id: bid.id },
      data: {
        status: dto.status,
        closedAt: dto.status === 'CLOSED' ? new Date() : bid.closedAt,
        notes: dto.reason ? `${bid.notes ?? ''}\n${dto.reason}`.trim() : bid.notes,
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'BID_STATUS_CHANGED',
      entityType: 'Bid',
      entityId: bid.id,
      payload: { from: bid.status, to: dto.status, reason: dto.reason },
    });

    return updated;
  }

  async listByRfq(ctx: Ctx, rfqId: string) {
    const supplierId = this.requireSupplierId(ctx);
    return this.prisma.bid.findMany({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        rfqId,
        ...(supplierId ? { supplierId } : {}),
      },
      include: {
        supplier: true,
        scores: true,
        lines: {
          include: {
            prLine: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ finalScore: 'desc' }, { submittedAt: 'asc' }],
    });
  }

  async get(ctx: Ctx, id: string) {
    return this.getScoped(ctx, id);
  }
}
