import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BidStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PolicyService } from '../policy/policy.service';
import { PrismaService } from '../prisma/prisma.service';
import { RulesService } from '../rules/rules.service';
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
        rfq: { include: { pr: true } },
        supplier: true,
        scores: true,
      },
    });
    if (!bid) throw new NotFoundException('Bid not found');
    return bid;
  }

  async upsertDraft(ctx: Ctx, dto: UpsertBidDto) {
    const supplierId = this.requireSupplierId(ctx);
    const rfq = await this.prisma.rFQ.findFirst({
      where: { id: dto.rfqId, tenantId: ctx.tenantId, companyId: ctx.companyId },
      include: { pr: true },
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
      throw new BadRequestException('Supplier is not linked to this RFQ');
    }

    const totalBidValue = dto.totalBidValue == null ? undefined : new Prisma.Decimal(dto.totalBidValue);

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
        currency: dto.currency,
        totalBidValue,
      },
      include: {
        supplier: true,
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: existing ? 'BID_DRAFT_UPDATED' : 'BID_DRAFT_CREATED',
      entityType: 'Bid',
      entityId: bid.id,
      payload: { rfqId: rfq.id, supplierId: dto.supplierId, version: bid.version },
    });

    return bid;
  }

  async submit(ctx: Ctx, id: string) {
    const bid = await this.getScoped(ctx, id);
    this.assertTransition(bid.status, 'SUBMITTED');

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

    const updated = await this.prisma.bid.update({
      where: { id: bid.id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
      include: { supplier: true },
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
      },
      orderBy: [{ finalScore: 'desc' }, { submittedAt: 'asc' }],
    });
  }

  async get(ctx: Ctx, id: string) {
    return this.getScoped(ctx, id);
  }
}
