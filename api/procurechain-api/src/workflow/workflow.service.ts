import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Ctx = {
  tenantId: string;
  companyId: string;
  userId?: string;
  roles?: string[];
  actorType?: 'INTERNAL' | 'PARTNER';
  partnerId?: string;
};

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  private isSupplierCtx(ctx: Ctx) {
    return ctx.actorType === 'PARTNER' && (ctx.roles ?? []).includes('SUPPLIER') && !!ctx.partnerId;
  }

  private requireSupplierId(ctx: Ctx) {
    if (!this.isSupplierCtx(ctx) || !ctx.partnerId) return undefined;
    return ctx.partnerId;
  }

  private async assertThreadAccess(ctx: Ctx, prId: string) {
    const supplierId = this.requireSupplierId(ctx);
    if (!supplierId) return;

    const scopedPo = await this.prisma.purchaseOrder.findFirst({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        prId,
        award: {
          is: {
            supplierId,
          },
        },
      },
      select: { id: true },
    });

    if (!scopedPo) {
      throw new ForbiddenException('Workflow chat is only available to the awarded supplier for this RFQ/PO workflow');
    }
  }

  private getActorLabel(ctx: Ctx, actorLabel?: string) {
    return actorLabel?.trim() || ctx.userId || 'dev-user';
  }

  async ensureThread(ctx: Ctx, prId: string) {
    const pr = await this.prisma.purchaseRequisition.findFirst({
      where: {
        id: prId,
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
      },
      select: { id: true },
    });

    if (!pr) {
      throw new NotFoundException('Purchase requisition not found');
    }

    return this.prisma.workflowThread.upsert({
      where: { prId },
      update: {},
      create: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        prId,
      },
    });
  }

  async addMessage(ctx: Ctx, prId: string, input: { message: string; authorLabel?: string }) {
    if (!input.message?.trim()) {
      throw new BadRequestException('message is required');
    }
    await this.assertThreadAccess(ctx, prId);
    const thread = await this.ensureThread(ctx, prId);
    return this.prisma.workflowMessage.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        threadId: thread.id,
        prId,
        authorId: ctx.userId ?? 'dev-user',
        authorLabel: this.getActorLabel(ctx, input.authorLabel),
        message: input.message.trim(),
      },
    });
  }

  async getThread(ctx: Ctx, prId: string) {
    await this.assertThreadAccess(ctx, prId);
    const thread = await this.ensureThread(ctx, prId);

    const [messages, rfqs, pos] = await Promise.all([
      this.prisma.workflowMessage.findMany({
        where: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          prId,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.rFQ.findMany({
        where: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          prId,
        },
        select: { id: true },
      }),
      this.prisma.purchaseOrder.findMany({
        where: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          prId,
        },
        select: { id: true },
      }),
    ]);

    const rfqIds = rfqs.map((item) => item.id);
    const poIds = pos.map((item) => item.id);

    const [bids, deliveryNotes, invoices] = await Promise.all([
      rfqIds.length
        ? this.prisma.bid.findMany({
            where: {
              tenantId: ctx.tenantId,
              companyId: ctx.companyId,
              rfqId: { in: rfqIds },
            },
            select: { id: true },
          })
        : [],
      poIds.length
        ? this.prisma.deliveryNote.findMany({
            where: {
              tenantId: ctx.tenantId,
              companyId: ctx.companyId,
              poId: { in: poIds },
            },
            select: { id: true },
          })
        : [],
      poIds.length
        ? this.prisma.invoice.findMany({
            where: {
              tenantId: ctx.tenantId,
              companyId: ctx.companyId,
              poId: { in: poIds },
            },
            select: { id: true },
          })
        : [],
    ]);

    const entityRefs: Array<{ entityType: string; ids: string[] }> = [
      { entityType: 'PurchaseRequisition', ids: [prId] },
      { entityType: 'RFQ', ids: rfqIds },
      { entityType: 'Bid', ids: bids.map((item) => item.id) },
      { entityType: 'PurchaseOrder', ids: poIds },
      { entityType: 'DeliveryNote', ids: deliveryNotes.map((item) => item.id) },
      { entityType: 'Invoice', ids: invoices.map((item) => item.id) },
    ].filter((ref) => ref.ids.length > 0);

    const audits = entityRefs.length
      ? await this.prisma.auditEvent.findMany({
          where: {
            tenantId: ctx.tenantId,
            companyId: ctx.companyId,
            OR: entityRefs.map((ref) => ({
              entityType: ref.entityType,
              entityId: { in: ref.ids },
            })),
          },
          orderBy: { ts: 'asc' },
        })
      : [];

    const entries = [
      ...audits.map((event) => ({
        id: `audit:${event.id}`,
        type: 'event' as const,
        at: event.ts.toISOString(),
        authorLabel: event.actor ?? 'System',
        entityType: event.entityType ?? 'System',
        entityId: event.entityId ?? null,
        eventType: event.eventType,
        payload: event.payload ?? null,
      })),
      ...messages.map((message) => ({
        id: `message:${message.id}`,
        type: 'message' as const,
        at: message.createdAt.toISOString(),
        authorLabel: message.authorLabel,
        authorId: message.authorId,
        message: message.message,
      })),
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    return {
      thread: {
        id: thread.id,
        prId: thread.prId,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
      },
      entries,
    };
  }
}
