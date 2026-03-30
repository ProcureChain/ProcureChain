import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ApprovalService } from './approval.service';
import { CreatePRDocumentDto, CreatePRDto, UpdatePRDto } from './pr.dto';
import { PRStatus, Prisma } from '@prisma/client';
import { RulesService } from '../rules/rules.service';

type UploadedBinary = {
  originalname: string;
  mimetype?: string;
  size?: number;
  buffer: Buffer;
};

@Injectable()
export class PRService {
  private readonly uploadsDir = join(process.cwd(), 'uploads', 'pr-documents');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly approvals: ApprovalService,
    private readonly rules: RulesService,
  ) {}

  private readonly allowedTransitions: Record<PRStatus, PRStatus[]> = {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['UNDER_REVIEW', 'REJECTED', 'APPROVED', 'RETURNED'],
    UNDER_REVIEW: ['APPROVED', 'REJECTED', 'RETURNED'],
    RETURNED: ['SUBMITTED'],
    APPROVED: ['CONVERTED_TO_RFQ', 'CLOSED'],
    CONVERTED_TO_RFQ: ['CLOSED'],
    CLOSED: [],
    REJECTED: ['CLOSED'],
  };

  private getActor(ctx: any) {
    return ctx.userId ?? 'dev-user';
  }

  private assertTransition(from: PRStatus, to: PRStatus) {
    const allowed = this.allowedTransitions[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(`PR transition not allowed: ${from} -> ${to}`);
    }
  }

  private isDocumentFieldKey(fieldKey: string) {
    return /(^|_)(doc|document|documents|attachment|attachments|file|files|upload|certificate|certificates|license|licence|permit|drawing|drawings)(_|$)/i.test(
      fieldKey,
    );
  }

  private async validateRequiredContent(params: {
    ctx: any;
    prId?: string;
    subcategoryId: string;
    title?: string;
    description?: string | null;
    currency?: string | null;
    costCentre?: string | null;
    department?: string | null;
    metadata?: Record<string, unknown> | null;
    pendingDocumentFieldKeys?: string[];
  }) {
    const dynamicValidation = await this.rules.validatePayload('PR', {
      subcategoryId: params.subcategoryId.trim(),
      country: 'ZA',
      payload: {
        title: params.title,
        description: params.description,
        currency: params.currency,
        costCentre: params.costCentre,
        department: params.department,
        subcategoryId: params.subcategoryId,
        metadata: params.metadata ?? {},
      },
    });

    const existingDocuments = params.prId
      ? await this.prisma.purchaseRequisitionDocument.findMany({
          where: {
            tenantId: params.ctx.tenantId,
            companyId: params.ctx.companyId,
            prId: params.prId,
          },
          select: { fieldKey: true },
        })
      : [];

    const availableDocumentKeys = new Set<string>([
      ...existingDocuments.map((doc) => doc.fieldKey).filter((value): value is string => Boolean(value)),
      ...(params.pendingDocumentFieldKeys ?? []).filter(Boolean),
    ]);

    const missingFields = dynamicValidation.missingFields.filter((missing) => {
      if (!missing.fieldPath.startsWith('metadata.')) return true;
      const key = missing.fieldPath.slice('metadata.'.length);
      if (!this.isDocumentFieldKey(key)) return true;
      return !availableDocumentKeys.has(key);
    });

    if (missingFields.length > 0) {
      throw new BadRequestException({
        message: 'Dynamic field validation failed for PR',
        missingFields,
        rulePackKey: dynamicValidation.rulePackKey,
      });
    }
  }

  private async getEditablePR(ctx: any, id: string) {
    const pr = await this.get(ctx, id);
    const hasRfq = await this.prisma.rFQ.findUnique({
      where: { prId: pr.id },
      select: { id: true },
    });
    const canEditApproved = pr.status === 'APPROVED' && !hasRfq;
    const editableStatuses: PRStatus[] = ['DRAFT', 'RETURNED'];
    if (!editableStatuses.includes(pr.status) && !canEditApproved) {
      throw new BadRequestException('Only DRAFT, RETURNED, or approved-not-yet-converted PRs can be edited');
    }

    return { pr, hasRfq: Boolean(hasRfq), canEditApproved };
  }

  private async storeDocumentFile(prId: string, file?: UploadedBinary) {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    // TODO: move PR document storage to object/blob storage in production.
    await mkdir(this.uploadsDir, { recursive: true });
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedName = `${prId}-${Date.now()}-${safeName}`;
    const storedPath = join(this.uploadsDir, storedName);
    await writeFile(storedPath, file.buffer);
    return {
      storagePath: storedPath,
      originalName: safeName,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    };
  }

  async createDraft(ctx: any, dto: CreatePRDto) {
    if (!dto.title?.trim()) {
      throw new BadRequestException('title is required');
    }
    if (!dto.subcategoryId?.trim()) {
      throw new BadRequestException('subcategoryId is required');
    }

    if (dto.validateRequired) {
      await this.validateRequiredContent({
        ctx,
        subcategoryId: dto.subcategoryId,
        title: dto.title.trim(),
        description: dto.description ?? null,
        currency: dto.currency ?? 'ZAR',
        costCentre: dto.costCentre ?? null,
        department: dto.department ?? null,
        metadata: dto.metadata ?? null,
      });
    }

    const pr = await this.prisma.purchaseRequisition.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        title: dto.title.trim(),
        description: dto.description,
        currency: dto.currency || 'ZAR',
        costCentre: dto.costCentre,
        department: dto.department,
        subcategoryId: dto.subcategoryId,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        status: 'DRAFT',
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: this.getActor(ctx),
      eventType: 'PR_CREATED',
      entityType: 'PurchaseRequisition',
      entityId: pr.id,
      payload: {
        title: pr.title,
        currency: pr.currency,
        subcategoryId: pr.subcategoryId,
        metadataKeys: dto.metadata ? Object.keys(dto.metadata) : [],
      },
    });

    return pr;
  }

  async list(ctx: any, limit = 50) {
    return this.prisma.purchaseRequisition.findMany({
      where: { tenantId: ctx.tenantId, companyId: ctx.companyId },
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(limit, 200)),
      include: {
        documents: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async get(ctx: any, id: string) {
    const pr = await this.prisma.purchaseRequisition.findFirst({
      where: { id, tenantId: ctx.tenantId, companyId: ctx.companyId },
      include: {
        documents: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!pr) throw new NotFoundException('PR not found');
    return pr;
  }

  async updateDraft(ctx: any, id: string, dto: UpdatePRDto) {
    const { pr, canEditApproved } = await this.getEditablePR(ctx, id);

    const nextTitle = dto.title?.trim() ?? pr.title;
    const nextDescription = dto.description ?? pr.description;
    const nextCostCentre = dto.costCentre ?? pr.costCentre;
    const nextDepartment = dto.department ?? pr.department;
    const nextSubcategoryId = dto.subcategoryId ?? pr.subcategoryId;
    const nextCurrency = dto.currency ?? pr.currency;
    const nextMetadata = (dto.metadata as Record<string, unknown> | undefined) ?? ((pr.metadata as Record<string, unknown> | null) ?? null);

    if (!nextSubcategoryId) {
      throw new BadRequestException('subcategoryId is required');
    }

    if (dto.validateRequired || canEditApproved) {
      await this.validateRequiredContent({
        ctx,
        prId: pr.id,
        subcategoryId: nextSubcategoryId,
        title: nextTitle,
        description: nextDescription,
        currency: nextCurrency,
        costCentre: nextCostCentre,
        department: nextDepartment,
        metadata: nextMetadata,
      });
    }

    const now = new Date();
    const updated = await this.prisma.purchaseRequisition.update({
      where: { id: pr.id },
      data: {
        title: nextTitle,
        description: nextDescription,
        costCentre: nextCostCentre,
        department: nextDepartment,
        subcategoryId: nextSubcategoryId,
        currency: nextCurrency,
        metadata: nextMetadata as Prisma.InputJsonValue | undefined,
        lastEditedAt: now,
        lastEditSource: dto.editSource ?? 'PR',
        ...(canEditApproved ? { editedAfterApprovalAt: now } : {}),
      },
      include: {
        documents: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: this.getActor(ctx),
      eventType: canEditApproved ? 'PR_APPROVED_EDITED' : 'PR_UPDATED',
      entityType: 'PurchaseRequisition',
      entityId: pr.id,
      payload: {
        title: updated.title,
        previousStatus: pr.status,
        currentStatus: updated.status,
        editSource: dto.editSource ?? 'PR',
        costCentre: updated.costCentre,
        department: updated.department,
        metadataKeys: nextMetadata ? Object.keys(nextMetadata) : undefined,
        editedAfterApprovalAt: updated.editedAfterApprovalAt?.toISOString?.() ?? updated.editedAfterApprovalAt ?? undefined,
      },
    });

    return updated;
  }

  async submit(ctx: any, id: string) {
    const pr = await this.get(ctx, id);
    this.assertTransition(pr.status, 'SUBMITTED');

    const subcategoryId = pr.subcategoryId;
    if (!subcategoryId) {
      throw new BadRequestException('subcategoryId is required to submit a PR');
    }

    const lineCount = await this.prisma.purchaseRequisitionLine.count({
      where: { prId: pr.id },
    });
    if (lineCount < 1) {
      throw new BadRequestException('At least one line item is required to submit a PR');
    }

    await this.validateRequiredContent({
      ctx,
      prId: pr.id,
      subcategoryId,
      title: pr.title,
      description: pr.description,
      currency: pr.currency,
      costCentre: pr.costCentre,
      department: pr.department,
      metadata: (pr.metadata as Record<string, unknown> | null) ?? null,
    });

    const subcat = await this.prisma.subcategory.findUnique({
      where: { id: subcategoryId },
    });
    if (!subcat) {
      throw new BadRequestException('Invalid subcategoryId');
    }

    const chain = await this.approvals.buildChainFromRules({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      archetype: subcat.archetype,
      costCentre: pr.costCentre,
      department: pr.department,
    });

    const updated = await this.prisma.purchaseRequisition.update({
      where: { id: pr.id },
      data: {
        status: 'SUBMITTED',
        approvalChain: chain,
        archetype: subcat.archetype,
        submittedAt: new Date(),
      },
      include: {
        documents: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: this.getActor(ctx),
      eventType: 'PR_SUBMITTED',
      entityType: 'PurchaseRequisition',
      entityId: pr.id,
      payload: {
        from: pr.status,
        archetype: subcat.archetype,
        subcategoryId: pr.subcategoryId,
        lineCount,
        approvalChain: chain,
      },
    });

    return updated;
  }

  async withdraw(ctx: any, id: string, reason?: string) {
    const pr = await this.get(ctx, id);
    if (!['SUBMITTED', 'UNDER_REVIEW', 'RETURNED'].includes(pr.status)) {
      throw new BadRequestException('Only submitted, under review, or returned PRs can be withdrawn');
    }

    const updated = await this.prisma.purchaseRequisition.update({
      where: { id: pr.id },
      data: {
        status: 'DRAFT',
        approvalChain: Prisma.JsonNull,
        submittedAt: null,
      },
      include: {
        documents: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: this.getActor(ctx),
      eventType: 'PR_WITHDRAWN',
      entityType: 'PurchaseRequisition',
      entityId: pr.id,
      payload: { from: pr.status, to: updated.status, reason },
    });

    return updated;
  }

  async addLine(ctx: any, prId: string, dto: any) {
    const { pr } = await this.getEditablePR(ctx, prId);

    if (!dto.description?.trim()) {
      throw new BadRequestException('description is required');
    }

    const qty = dto.quantity == null ? 1 : Number(dto.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new BadRequestException('quantity must be > 0');
    }

    const line = await this.prisma.purchaseRequisitionLine.create({
      data: {
        prId,
        description: dto.description.trim(),
        quantity: qty,
        uom: dto.uom,
        notes: dto.notes,
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: this.getActor(ctx),
      eventType: 'PR_LINE_ADDED',
      entityType: 'PurchaseRequisition',
      entityId: prId,
      payload: {
        lineId: line.id,
        quantity: qty,
        uom: dto.uom,
        prStatus: pr.status,
      },
    });

    return line;
  }

  async listLines(ctx: any, prId: string) {
    await this.get(ctx, prId);
    return this.prisma.purchaseRequisitionLine.findMany({
      where: { prId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async removeLine(ctx: any, prId: string, lineId: string) {
    const { pr } = await this.getEditablePR(ctx, prId);

    const line = await this.prisma.purchaseRequisitionLine.findFirst({
      where: { id: lineId, prId },
    });
    if (!line) throw new NotFoundException('Line not found');

    await this.prisma.purchaseRequisitionLine.delete({
      where: { id: lineId },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: this.getActor(ctx),
      eventType: 'PR_LINE_REMOVED',
      entityType: 'PurchaseRequisition',
      entityId: prId,
      payload: { lineId, prStatus: pr.status },
    });

    return { ok: true };
  }

  async recalculateTotal(ctx: any, prId: string) {
    await this.get(ctx, prId);

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: this.getActor(ctx),
      eventType: 'PR_SCOPE_REVALIDATED',
      entityType: 'PurchaseRequisition',
      entityId: prId,
      payload: { scopeOnly: true },
    });

    const lineCount = await this.prisma.purchaseRequisitionLine.count({ where: { prId } });
    return { ok: true, lineCount };
  }

  async transitionStatus(ctx: any, id: string, nextStatus: PRStatus, reason?: string) {
    const pr = await this.get(ctx, id);
    this.assertTransition(pr.status, nextStatus);

    if ((nextStatus === 'REJECTED' || nextStatus === 'RETURNED') && !reason?.trim()) {
      throw new BadRequestException('reason is required when rejecting or requesting info on a PR');
    }

    const updated = await this.prisma.purchaseRequisition.update({
      where: { id: pr.id },
      data: { status: nextStatus },
      include: {
        documents: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: this.getActor(ctx),
      eventType: nextStatus === 'RETURNED' ? 'PR_INFO_REQUESTED' : 'PR_STATUS_CHANGED',
      entityType: 'PurchaseRequisition',
      entityId: pr.id,
      payload: { from: pr.status, to: nextStatus, reason },
    });

    return updated;
  }

  async listDocuments(ctx: any, prId: string) {
    await this.get(ctx, prId);
    return this.prisma.purchaseRequisitionDocument.findMany({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        prId,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async uploadDocument(ctx: any, prId: string, dto: CreatePRDocumentDto, file?: UploadedBinary) {
    await this.getEditablePR(ctx, prId);
    const stored = await this.storeDocumentFile(prId, file);
    const document = await this.prisma.purchaseRequisitionDocument.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        prId,
        fieldKey: dto.fieldKey?.trim() || null,
        label: dto.label?.trim() || null,
        originalName: stored.originalName,
        mimeType: stored.mimeType ?? null,
        sizeBytes: stored.sizeBytes ?? null,
        storagePath: stored.storagePath,
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: this.getActor(ctx),
      eventType: 'PR_DOCUMENT_UPLOADED',
      entityType: 'PurchaseRequisition',
      entityId: prId,
      payload: {
        documentId: document.id,
        fieldKey: document.fieldKey,
        originalName: document.originalName,
      },
    });

    return document;
  }

  async downloadDocument(ctx: any, documentId: string, res: Response) {
    const document = await this.prisma.purchaseRequisitionDocument.findFirst({
      where: {
        id: documentId,
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
      },
    });
    if (!document) {
      throw new NotFoundException('PR document not found');
    }

    const file = await readFile(document.storagePath);
    res.setHeader('content-type', document.mimeType || 'application/octet-stream');
    res.setHeader('content-disposition', `attachment; filename="${document.originalName}"`);
    res.send(file);
  }
}
