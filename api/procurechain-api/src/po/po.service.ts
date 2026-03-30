import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { POStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClosePODto, CreatePOFromAwardDto, SupplierRespondPODto } from './po.dto';

@Injectable()
export class POService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private readonly allowedTransitions: Record<POStatus, POStatus[]> = {
    DRAFT: ['RELEASED', 'CLOSED'],
    RELEASED: ['ACCEPTED', 'CHANGE_REQUESTED', 'CLOSED'],
    ACCEPTED: ['CLOSED'],
    CHANGE_REQUESTED: ['RELEASED', 'CLOSED', 'ACCEPTED'],
    CLOSED: [],
  };

  private assertTransition(from: POStatus, to: POStatus) {
    const allowed = this.allowedTransitions[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(`PO transition not allowed: ${from} -> ${to}`);
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
    const po = await this.prisma.purchaseOrder.findFirst({
      where: {
        id,
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        ...(supplierId ? { award: { is: { supplierId } } } : {}),
      },
      include: {
        award: {
          include: {
            rfq: true,
            supplier: true,
          },
        },
        changeRequests: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!po) throw new NotFoundException('PO not found');
    return po;
  }

  async createFromAward(ctx: any, dto: CreatePOFromAwardDto) {
    this.assertInternalOnly(ctx, 'PO creation');
    const award = await this.prisma.rFQAward.findFirst({
      where: {
        id: dto.awardId,
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
      },
      include: {
        rfq: {
          include: {
            pr: true,
          },
        },
        bid: true,
      },
    });

    if (!award) throw new BadRequestException('Award not found in tenant scope');
    if (!['AWARDED', 'CLOSED'].includes(award.rfq.status)) {
      throw new BadRequestException('PO can only be created from AWARDED/CLOSED RFQ');
    }

    const existing = await this.prisma.purchaseOrder.findUnique({
      where: { awardId: award.id },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('PO already exists for this award');
    }

    const poNumber = `PO-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${award.rfqId.slice(0, 6).toUpperCase()}`;

    if (!award.bid?.totalBidValue) {
      throw new BadRequestException('Awarded bid must contain a totalBidValue before PO creation');
    }

    const committedAmount = new Prisma.Decimal(award.bid.totalBidValue);

    const po = await this.prisma.purchaseOrder.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        poNumber,
        status: 'DRAFT',
        commercialOnly: true,
        currency: award.bid.currency || award.rfq.currency || award.rfq.pr.currency,
        committedAmount,
        terms: dto.terms,
        notes: dto.notes,
        awardId: award.id,
        rfqId: award.rfqId,
        prId: award.rfq.prId,
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'PO_CREATED_FROM_AWARD',
      entityType: 'PurchaseOrder',
      entityId: po.id,
      payload: {
        poNumber: po.poNumber,
        awardId: award.id,
        rfqId: award.rfqId,
        prId: award.rfq.prId,
        commercialOnly: true,
      },
    });

    return this.getScoped(ctx, po.id);
  }

  async release(ctx: any, id: string) {
    this.assertInternalOnly(ctx, 'PO release');
    const po = await this.getScoped(ctx, id);
    this.assertTransition(po.status, 'RELEASED');

    const updated = await this.prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'PO_RELEASED',
      entityType: 'PurchaseOrder',
      entityId: po.id,
      payload: {},
    });

    return updated;
  }

  async supplierRespond(ctx: any, id: string, dto: SupplierRespondPODto) {
    this.requireSupplierId(ctx);
    const po = await this.getScoped(ctx, id);

    if (dto.action === 'ACCEPT') {
      this.assertTransition(po.status, 'ACCEPTED');

      const updated = await this.prisma.purchaseOrder.update({
        where: { id: po.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });

      await this.audit.record({
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        actor: ctx.userId ?? 'dev-user',
        eventType: 'PO_SUPPLIER_ACCEPTED',
        entityType: 'PurchaseOrder',
        entityId: po.id,
        payload: {
          requestedBy: dto.requestedBy ?? ctx.userId ?? 'dev-user',
        },
      });

      return updated;
    }

    this.assertTransition(po.status, 'CHANGE_REQUESTED');
    if (!dto.reason?.trim()) {
      throw new BadRequestException('reason is required for REQUEST_CHANGE');
    }
    const reason = dto.reason.trim();

    await this.prisma.$transaction(async (tx) => {
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: 'CHANGE_REQUESTED' },
      });

      await tx.pOChangeRequest.create({
        data: {
          poId: po.id,
          reason,
          proposedTerms: dto.proposedTerms,
          requestedBy: dto.requestedBy,
          status: 'OPEN',
        },
      });
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'PO_CHANGE_REQUESTED',
      entityType: 'PurchaseOrder',
      entityId: po.id,
      payload: {
        reason,
        proposedTerms: dto.proposedTerms,
        requestedBy: dto.requestedBy ?? ctx.userId ?? 'dev-user',
      },
    });

    return this.getScoped(ctx, po.id);
  }

  async close(ctx: any, id: string, dto: ClosePODto) {
    this.assertInternalOnly(ctx, 'PO close');
    const po = await this.getScoped(ctx, id);
    this.assertTransition(po.status, 'CLOSED');

    const paidInvoices = await this.prisma.invoice.count({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        poId: po.id,
        status: 'PAID',
      },
    });
    if (paidInvoices < 1) {
      throw new BadRequestException('PO can only be closed after the final invoice has been signed and payment confirmed');
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'PO_CLOSED',
      entityType: 'PurchaseOrder',
      entityId: po.id,
      payload: { reason: dto.reason },
    });

    return updated;
  }

  async list(ctx: any, limit = 50) {
    const supplierId = this.requireSupplierId(ctx);
    return this.prisma.purchaseOrder.findMany({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        ...(supplierId ? { award: { is: { supplierId } } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(limit, 200)),
      include: {
        award: {
          include: {
            supplier: true,
            rfq: true,
          },
        },
      },
    });
  }

  async get(ctx: any, id: string) {
    return this.getScoped(ctx, id);
  }
}
