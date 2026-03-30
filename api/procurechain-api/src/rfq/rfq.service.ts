import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type {
  AddRFQSuppliersDto,
  AttachSupplierFormDto,
  AwardRFQDto,
  CreateRFQDto,
  CreateSupplierFormTemplateDto,
  ReleaseRFQDto,
} from './rfq.dto';
import { RFQReleaseMode, RFQStatus } from '@prisma/client';
import { RulesService } from '../rules/rules.service';
import { PolicyService } from '../policy/policy.service';
import { ComplianceService } from '../compliance/compliance.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';

@Injectable()
export class RfqService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rules: RulesService,
    private readonly policy: PolicyService,
    private readonly compliance: ComplianceService,
    private readonly taxonomy: TaxonomyService,
  ) {}

  private readonly allowedTransitions: Record<RFQStatus, RFQStatus[]> = {
    DRAFT: ['RELEASED'],
    RELEASED: ['OPEN'],
    OPEN: ['AWARDED', 'CLOSED'],
    AWARDED: ['CLOSED'],
    CLOSED: [],
  };

  private normalizeSupplierFormFields(
    fields: Array<{ id?: string; key?: string; label?: string; type?: 'TEXT' | 'NUMBER' | 'DOCUMENT'; required?: boolean }>,
  ) {
    if (!Array.isArray(fields) || fields.length < 1) {
      throw new BadRequestException('Form must include at least one field');
    }

    const normalized = fields.map((field, index) => {
      const type = field.type?.toUpperCase();
      if (!type || !['TEXT', 'NUMBER', 'DOCUMENT'].includes(type)) {
        throw new BadRequestException(`Invalid field type at index ${index}; allowed: TEXT, NUMBER, DOCUMENT`);
      }
      const key = field.key?.trim();
      const label = field.label?.trim();
      if (!key || !label) {
        throw new BadRequestException(`Field key and label are required at index ${index}`);
      }

      return {
        id: field.id?.trim() || `${key}-${index + 1}`,
        key,
        label,
        type,
        required: field.required === true,
      };
    });

    const keySet = new Set<string>();
    for (const field of normalized) {
      if (keySet.has(field.key)) {
        throw new BadRequestException(`Duplicate field key detected: ${field.key}`);
      }
      keySet.add(field.key);
    }

    return normalized;
  }

  private assertTransition(from: RFQStatus, to: RFQStatus) {
    const allowed = this.allowedTransitions[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(`RFQ transition not allowed: ${from} -> ${to}`);
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

  private async getScoped(ctx: any, id: string) {
    const supplierId = this.requireSupplierId(ctx);
    const rfq = await this.prisma.rFQ.findFirst({
      where: {
        id,
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        ...(supplierId ? { suppliers: { some: { supplierId } } } : {}),
      },
      include: {
        pr: true,
        suppliers: { include: { supplier: true } },
        supplierForms: {
          include: {
            template: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        bids: true,
        award: { include: { bid: true } },
      },
    });

    if (!rfq) throw new NotFoundException('RFQ not found');
    return rfq;
  }

  async list(ctx: any, limit = 100) {
    const supplierId = this.requireSupplierId(ctx);
    return this.prisma.rFQ.findMany({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        ...(supplierId ? { suppliers: { some: { supplierId } } } : {}),
      },
      include: {
        pr: true,
        suppliers: { include: { supplier: true } },
        supplierForms: {
          include: {
            template: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        bids: true,
        award: { include: { bid: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: Math.max(1, Math.min(limit, 200)),
    });
  }

  async listSupplierFormTemplates(ctx: any, limit = 100) {
    this.assertInternalOnly(ctx, 'Supplier form template listing');
    return this.prisma.supplierFormTemplate.findMany({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        isActive: true,
        isReusable: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: Math.max(1, Math.min(limit, 200)),
    });
  }

  async createSupplierFormTemplate(ctx: any, dto: CreateSupplierFormTemplateDto) {
    this.assertInternalOnly(ctx, 'Supplier form template creation');
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('name is required');
    const normalizedFields = this.normalizeSupplierFormFields(dto.fields ?? []);

    const template = await this.prisma.supplierFormTemplate.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        name,
        description: dto.description?.trim(),
        fields: normalizedFields,
        isReusable: dto.isReusable !== false,
        isActive: true,
        createdBy: ctx.userId ?? 'dev-user',
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'RFQ_SUPPLIER_FORM_TEMPLATE_CREATED',
      entityType: 'RFQ',
      entityId: template.id,
      payload: {
        name: template.name,
        fieldCount: normalizedFields.length,
        isReusable: template.isReusable,
      },
    });

    return template;
  }

  async listRfqSupplierForms(ctx: any, rfqId: string) {
    await this.getScoped(ctx, rfqId);
    return this.prisma.rFQSupplierFormAssignment.findMany({
      where: { rfqId, tenantId: ctx.tenantId, companyId: ctx.companyId },
      include: { template: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async attachSupplierForm(ctx: any, rfqId: string, dto: AttachSupplierFormDto) {
    this.assertInternalOnly(ctx, 'RFQ supplier form attachment');
    await this.getScoped(ctx, rfqId);

    let templateId = dto.templateId?.trim();
    if (!templateId) {
      const name = dto.name?.trim();
      if (!name) throw new BadRequestException('templateId or inline name is required');
      const normalizedFields = this.normalizeSupplierFormFields(dto.fields ?? []);
      const createdTemplate = await this.prisma.supplierFormTemplate.create({
        data: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          name,
          description: dto.description?.trim(),
          fields: normalizedFields,
          isReusable: dto.saveForReuse !== false,
          isActive: true,
          createdBy: ctx.userId ?? 'dev-user',
        },
      });
      templateId = createdTemplate.id;
    }

    const template = await this.prisma.supplierFormTemplate.findFirst({
      where: { id: templateId, tenantId: ctx.tenantId, companyId: ctx.companyId, isActive: true },
    });
    if (!template) throw new BadRequestException('Supplier form template not found');

    const assignment = await this.prisma.rFQSupplierFormAssignment.upsert({
      where: { rfqId_templateId: { rfqId, templateId: template.id } },
      create: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        rfqId,
        templateId: template.id,
        isRequired: dto.isRequired !== false,
      },
      update: {
        isRequired: dto.isRequired !== false,
      },
      include: { template: true },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'RFQ_SUPPLIER_FORM_ATTACHED',
      entityType: 'RFQ',
      entityId: rfqId,
      payload: {
        templateId: template.id,
        templateName: template.name,
        isRequired: assignment.isRequired,
      },
    });

    return assignment;
  }

  async create(ctx: any, dto: CreateRFQDto) {
    this.assertInternalOnly(ctx, 'RFQ creation');
    if (!dto.prId) throw new BadRequestException('prId is required');
    if (!dto.title?.trim()) throw new BadRequestException('title is required');

    // Must link to APPROVED PR
    const pr = await this.prisma.purchaseRequisition.findFirst({
      where: {
        id: dto.prId,
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        status: 'APPROVED',
      },
    });
    if (!pr) throw new BadRequestException('PR must exist and be APPROVED to create an RFQ');
    if (!pr.subcategoryId) throw new BadRequestException('PR subcategoryId is required for RFQ validation');

    const dynamicValidation = await this.rules.validatePayload('RFQ', {
      subcategoryId: pr.subcategoryId,
      country: 'ZA',
      payload: { ...dto, subcategoryId: pr.subcategoryId },
    });
    if (!dynamicValidation.valid) {
      throw new BadRequestException({
        message: 'Dynamic field validation failed for RFQ',
        missingFields: dynamicValidation.missingFields,
        rulePackKey: dynamicValidation.rulePackKey,
      });
    }

    const procurementDecision = await this.policy.resolveProcurementMethod(ctx, {
      budgetAmount: Number(dto.budgetAmount),
      isEmergency: dto.isEmergency,
      requestedMethod: dto.procurementMethod,
      emergencyJustification: dto.emergencyJustification,
    });

    const rfq = await this.prisma.rFQ.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        prId: pr.id,
        status: 'DRAFT',
        title: dto.title.trim(),
        notes: dto.notes,
        budgetAmount: new Prisma.Decimal(dto.budgetAmount),
        currency: dto.currency,
        paymentTerms: dto.paymentTerms,
        taxIncluded: dto.taxIncluded,
        priceValidityDays: dto.priceValidityDays,
        procurementBand: procurementDecision.band,
        procurementMethod: procurementDecision.method,
        isEmergency: dto.isEmergency === true,
        emergencyJustification: dto.emergencyJustification?.trim(),
      },
      include: {
        pr: true,
        suppliers: { include: { supplier: true } },
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'RFQ_CREATED',
      entityType: 'RFQ',
      entityId: rfq.id,
      payload: {
        prId: pr.id,
        status: 'DRAFT',
        budgetAmount: dto.budgetAmount,
        currency: dto.currency,
        paymentTerms: dto.paymentTerms,
        taxIncluded: dto.taxIncluded,
        priceValidityDays: dto.priceValidityDays,
        procurementBand: procurementDecision.band,
        procurementMethod: procurementDecision.method,
        isEmergency: dto.isEmergency === true,
      },
    });

    await this.prisma.purchaseRequisition.update({
      where: { id: pr.id },
      data: { status: 'CONVERTED_TO_RFQ' },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'PR_CONVERTED_TO_RFQ',
      entityType: 'PurchaseRequisition',
      entityId: pr.id,
      payload: { rfqId: rfq.id },
    });

    return rfq;
  }

  async addSuppliers(ctx: any, id: string, dto: AddRFQSuppliersDto) {
    this.assertInternalOnly(ctx, 'RFQ supplier selection');
    const rfq = await this.getScoped(ctx, id);

    if (!['DRAFT', 'RELEASED'].includes(rfq.status)) {
      throw new BadRequestException('Can only add suppliers while RFQ is DRAFT or RELEASED');
    }

    const supplierIds = Array.isArray(dto.supplierIds) ? dto.supplierIds : [];
    if (supplierIds.length < 1) throw new BadRequestException('supplierIds must contain at least one id');

    // Ensure suppliers exist + scoped
    const existing = await this.prisma.supplier.findMany({
      where: { id: { in: supplierIds }, tenantId: ctx.tenantId, companyId: ctx.companyId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map(s => s.id));
    const missing = supplierIds.filter(id => !existingIds.has(id));
    if (missing.length) throw new BadRequestException(`Invalid supplierIds: ${missing.join(', ')}`);

    await this.prisma.rFQSupplier.createMany({
      data: supplierIds.map(supplierId => ({
        rfqId: rfq.id,
        supplierId,
      })),
      skipDuplicates: true,
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'RFQ_SUPPLIERS_ADDED',
      entityType: 'RFQ',
      entityId: rfq.id,
      payload: { supplierIds },
    });

    return this.getScoped(ctx, rfq.id);
  }

  async release(ctx: any, id: string, dto?: ReleaseRFQDto) {
    this.assertInternalOnly(ctx, 'RFQ release');
    await this.policy.assertActionAllowed(ctx, 'RFQ_RELEASE');
    const rfq = await this.getScoped(ctx, id);
    this.assertTransition(rfq.status, 'RELEASED');

    const requestedReleaseMode: RFQReleaseMode = dto?.releaseMode ?? 'PRIVATE';
    const releaseMode: RFQReleaseMode = requestedReleaseMode === 'PUBLIC' ? 'GLOBAL' : requestedReleaseMode;
    let supplierCount = rfq.suppliers.length;
    const isGlobalMode = releaseMode === 'GLOBAL';
    const isLocalMode = releaseMode === 'LOCAL';

    if (isGlobalMode || isLocalMode) {
      const subcategoryId = rfq.pr.subcategoryId;
      if (!subcategoryId) {
        throw new BadRequestException('PR subcategoryId is required for LOCAL/GLOBAL RFQ release');
      }
      const canonicalId = this.taxonomy.normalizeAppendixCSubcategoryId(subcategoryId);
      const categoryIds = [...new Set([subcategoryId, canonicalId])];
      const localCountryCode = (dto?.localCountryCode?.trim() || 'ZA').toUpperCase();

      const eligibleSuppliers = await this.prisma.supplier.findMany({
        where: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          status: 'ACTIVE',
          ...(isLocalMode
            ? {
                country: localCountryCode,
              }
            : {}),
          tags: {
            some: {
              subcategoryId: {
                in: categoryIds,
              },
            },
          },
        },
        select: { id: true },
      });

      if (eligibleSuppliers.length < 1) {
        throw new BadRequestException(
          isLocalMode
            ? `No eligible local suppliers found for country ${localCountryCode} in this RFQ category`
            : 'No eligible global suppliers found in this RFQ category',
        );
      }

      await this.prisma.rFQSupplier.createMany({
        data: eligibleSuppliers.map((s) => ({ rfqId: rfq.id, supplierId: s.id })),
        skipDuplicates: true,
      });

      supplierCount = await this.prisma.rFQSupplier.count({
        where: { rfqId: rfq.id },
      });
    } else if (rfq.suppliers.length < 1) {
      throw new BadRequestException('PRIVATE release requires at least one selected supplier');
    }

    const updated = await this.prisma.rFQ.update({
      where: { id: rfq.id },
      data: { status: 'RELEASED', releaseMode, releasedAt: new Date() },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'RFQ_RELEASED',
      entityType: 'RFQ',
      entityId: rfq.id,
      payload: {
        releaseMode,
        supplierCount,
        localCountryCode: isLocalMode ? (dto?.localCountryCode?.trim() || 'ZA').toUpperCase() : null,
      },
    });

    return updated;
  }

  async open(ctx: any, id: string) {
    this.assertInternalOnly(ctx, 'RFQ opening');
    await this.policy.assertActionAllowed(ctx, 'RFQ_OPEN');
    const rfq = await this.getScoped(ctx, id);
    this.assertTransition(rfq.status, 'OPEN');

    const updated = await this.prisma.rFQ.update({
      where: { id: rfq.id },
      data: { status: 'OPEN', openedAt: new Date() },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'RFQ_OPENED',
      entityType: 'RFQ',
      entityId: rfq.id,
      payload: {},
    });

    return updated;
  }

  async award(ctx: any, id: string, dto: AwardRFQDto) {
    this.assertInternalOnly(ctx, 'RFQ award');
    await this.policy.assertActionAllowed(ctx, 'RFQ_AWARD');
    const rfq = await this.getScoped(ctx, id);
    this.assertTransition(rfq.status, 'AWARDED');

    if (!dto.bidId?.trim()) {
      throw new BadRequestException('bidId is required for RFQ award decisions');
    }
    if (!dto.overrideReason?.trim()) {
      throw new BadRequestException('overrideReason is required for award decisions');
    }

    const matchedSupplier = rfq.suppliers.find((s) => s.supplierId === dto.supplierId);
    if (!matchedSupplier) {
      throw new BadRequestException('supplierId must belong to this RFQ');
    }
    const matchedBid = rfq.bids.find((b) => b.id === dto.bidId);
    if (!matchedBid) {
      throw new BadRequestException('bidId must belong to this RFQ');
    }
    if (matchedBid.supplierId !== dto.supplierId) {
      throw new BadRequestException('bidId supplier does not match supplierId');
    }
    const awardableBidStatuses = ['SUBMITTED', 'OPENED', 'UNDER_EVALUATION', 'SHORTLISTED', 'AWARD_RECOMMENDED'];
    if (!awardableBidStatuses.includes(matchedBid.status)) {
      throw new BadRequestException(
        `bidId must be in one of the awardable statuses: ${awardableBidStatuses.join(', ')}`,
      );
    }
    await this.compliance.assertAwardAllowed(ctx, rfq.id, dto.supplierId);

    let awardedBidCurrency: string | null = null;
    let awardedBidTotalValue: Prisma.Decimal | null = null;
    let awardRecordId: string | null = null;
    let autoCreatedPoId: string | null = null;
    let autoCreatedPoNumber: string | null = null;
    let autoCreatedPoStatus: string | null = null;

    await this.prisma.$transaction(async (tx) => {
      const award = await tx.rFQAward.upsert({
        where: { rfqId: rfq.id },
        create: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          rfqId: rfq.id,
          bidId: dto.bidId,
          supplierId: dto.supplierId,
          overrideReason: dto.overrideReason.trim(),
          notes: dto.notes,
        },
        update: {
          bidId: dto.bidId,
          supplierId: dto.supplierId,
          overrideReason: dto.overrideReason.trim(),
          notes: dto.notes,
          awardedAt: new Date(),
        },
      });
      awardRecordId = award.id;

      await tx.bid.updateMany({
        where: {
          rfqId: rfq.id,
          id: { not: dto.bidId },
          status: { in: ['SUBMITTED', 'OPENED', 'UNDER_EVALUATION', 'SHORTLISTED', 'AWARD_RECOMMENDED'] },
        },
        data: {
          status: 'REJECTED',
          closedAt: new Date(),
          recommended: false,
        },
      });
      const winningBid = await tx.bid.update({
        where: { id: dto.bidId },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          recommended: true,
        },
      });
      awardedBidCurrency = winningBid.currency;
      awardedBidTotalValue = winningBid.totalBidValue;

      await tx.rFQ.update({
        where: { id: rfq.id },
        data: { status: 'AWARDED' },
      });

      const existingPo = await tx.purchaseOrder.findUnique({
        where: { awardId: award.id },
        select: { id: true },
      });

      if (!existingPo) {
        if (!winningBid.totalBidValue) {
          throw new BadRequestException('Awarded bid must contain a totalBidValue before PO creation');
        }

        const poNumber = `PO-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${rfq.id.slice(0, 6).toUpperCase()}`;
        const po = await tx.purchaseOrder.create({
          data: {
            tenantId: ctx.tenantId,
            companyId: ctx.companyId,
            poNumber,
            status: 'DRAFT',
            commercialOnly: true,
            currency: winningBid.currency || rfq.currency || rfq.pr.currency,
            committedAmount: new Prisma.Decimal(winningBid.totalBidValue),
            terms: rfq.paymentTerms ?? undefined,
            notes: `Auto-created from RFQ award ${rfq.id}`,
            awardId: award.id,
            rfqId: rfq.id,
            prId: rfq.prId,
          },
        });

        autoCreatedPoId = po.id;
        autoCreatedPoNumber = po.poNumber;
        autoCreatedPoStatus = po.status;
      }
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'RFQ_AWARDED',
      entityType: 'RFQ',
      entityId: rfq.id,
      payload: {
        bidId: dto.bidId,
        supplierId: dto.supplierId,
        overrideReason: dto.overrideReason,
        autoCreatedPo: autoCreatedPoId
          ? {
              id: autoCreatedPoId,
              poNumber: autoCreatedPoNumber,
              status: autoCreatedPoStatus,
            }
          : null,
      },
    });

    if (autoCreatedPoId && autoCreatedPoNumber && awardRecordId) {
      await this.audit.record({
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        actor: ctx.userId ?? 'dev-user',
        eventType: 'PO_CREATED_FROM_AWARD',
        entityType: 'PurchaseOrder',
        entityId: autoCreatedPoId,
        payload: {
          poNumber: autoCreatedPoNumber,
          awardId: awardRecordId,
          rfqId: rfq.id,
          prId: rfq.prId,
          commercialOnly: true,
          currency: awardedBidCurrency,
          committedAmount: awardedBidTotalValue ? Number(awardedBidTotalValue) : null,
          autoCreated: true,
        },
      });
    }

    return this.getScoped(ctx, rfq.id);
  }

  async close(ctx: any, id: string, reason?: string) {
    this.assertInternalOnly(ctx, 'RFQ close');
    const rfq = await this.getScoped(ctx, id);
    this.assertTransition(rfq.status, 'CLOSED');

    if (rfq.status === 'OPEN' && !reason?.trim()) {
      throw new BadRequestException('reason is required when closing an OPEN RFQ without an award');
    }

    const updated = await this.prisma.rFQ.update({
      where: { id: rfq.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'RFQ_CLOSED',
      entityType: 'RFQ',
      entityId: rfq.id,
      payload: { reason },
    });

    return updated;
  }

  async get(ctx: any, id: string) {
    return this.getScoped(ctx, id);
  }
}
