import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { InvoiceLifecycleStatus, InvoiceMatchStatus, InvoiceSourceSystem, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QuickBooksAdapter } from './adapters/quickbooks.adapter';
import { AdapterInvoiceSnapshot } from './adapters/erp.adapter';
import {
  CreateDeliveryNoteDto,
  CreateSupplierInvoiceDto,
  CreateInvoiceFromTemplateDto,
  MarkInvoicePaidDto,
  ReviewInvoiceDto,
  SignInvoiceDto,
  SubmitSupplierInvoiceDto,
  SyncInvoicesDto,
} from './finance.dto';
import { RulesService } from '../rules/rules.service';
import { createHash } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { Response } from 'express';
import PDFDocument = require('pdfkit');

type UploadedBinary = {
  originalname: string;
  buffer: Buffer;
};

@Injectable()
export class FinanceService {
  private readonly quickBooks = new QuickBooksAdapter();
  private readonly uploadsDir = join(process.cwd(), 'uploads', 'invoices');
  private readonly deliveryUploadsDir = join(process.cwd(), 'uploads', 'delivery-notes');
  private readonly paymentProofUploadsDir = join(process.cwd(), 'uploads', 'payment-proofs');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rules: RulesService,
  ) {}

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

  private async getScopedPO(ctx: any, poId: string) {
    const supplierId = this.requireSupplierId(ctx);
    const po = await this.prisma.purchaseOrder.findFirst({
      where: {
        id: poId,
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        ...(supplierId ? { award: { is: { supplierId } } } : {}),
      },
      include: {
        pr: true,
        award: {
          include: {
            supplier: true,
          },
        },
      },
    });
    if (!po) throw new NotFoundException('PO not found');
    return po;
  }

  private async getScopedInvoice(ctx: any, invoiceId: string) {
    const supplierId = this.requireSupplierId(ctx);
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        ...(supplierId ? { supplierId } : {}),
      },
      include: {
        purchaseOrder: {
          include: {
            pr: true,
          },
        },
        supplier: true,
        deliveryNote: true,
        signature: true,
        paymentProofs: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  private formatMoney(value: Prisma.Decimal | number | string | null | undefined, currency = 'ZAR') {
    const amount = typeof value === 'object' && value && 'toNumber' in value ? value.toNumber() : Number(value ?? 0);
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  private formatDate(value?: Date | string | null) {
    if (!value) return '-';
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toISOString().slice(0, 10);
  }

  private escapeHtml(value?: string | null) {
    return (value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private async buildInvoiceViewModel(ctx: any, invoiceId: string) {
    const invoice = await this.getScopedInvoice(ctx, invoiceId);
    const prLines = invoice.purchaseOrder.prId
      ? await this.prisma.purchaseRequisitionLine.findMany({
          where: { prId: invoice.purchaseOrder.prId },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    return {
      invoice,
      prLines,
      buyerName: invoice.companyId,
      buyerAddress: invoice.purchaseOrder.pr.department ?? '',
      currency: invoice.currency,
      subtotal: invoice.subtotal,
      taxRatePercent:
        Number(invoice.subtotal) > 0 ? Math.round((Number(invoice.taxAmount) / Number(invoice.subtotal)) * 10000) / 100 : 0,
      taxAmount: invoice.taxAmount,
      totalAmount: invoice.totalAmount,
      supplierName: invoice.supplier?.name ?? '-',
      supplierCountry: invoice.supplier?.country ?? '-',
      poNumber: invoice.purchaseOrder.poNumber,
      deliveryNoteNumber: invoice.deliveryNote?.noteNumber ?? '-',
    };
  }

  private renderInvoiceHtml(view: Awaited<ReturnType<FinanceService['buildInvoiceViewModel']>>) {
    const lineRows = view.prLines.length
      ? view.prLines
          .map(
            (line, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${this.escapeHtml(line.description)}</td>
                <td>${line.quantity}</td>
                <td>${this.escapeHtml(line.uom ?? '-')}</td>
              </tr>`,
          )
          .join('')
      : `<tr><td>1</td><td>PO commercial commitment</td><td>1</td><td>Lot</td></tr>`;

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Invoice ${this.escapeHtml(view.invoice.invoiceNumber)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #0f172a; margin: 32px; }
      .header, .meta, .totals { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
      .header td { vertical-align: top; }
      .meta td, .meta th, .items td, .items th, .totals td { border: 1px solid #cbd5e1; padding: 8px; }
      .items { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
      .muted { color: #475569; font-size: 12px; }
      .title { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
      .block-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #334155; margin-bottom: 6px; }
      .totals { margin-left: auto; width: 340px; }
      .totals td:first-child { font-weight: 600; }
    </style>
  </head>
  <body>
    <table class="header">
      <tr>
        <td>
          <div class="title">Invoice</div>
          <div class="muted">Supplier-issued procurement invoice</div>
        </td>
        <td style="text-align:right">
          <div><strong>Invoice #:</strong> ${this.escapeHtml(view.invoice.invoiceNumber)}</div>
          <div><strong>Invoice Date:</strong> ${this.formatDate(view.invoice.issueDate)}</div>
          <div><strong>Due Date:</strong> ${this.formatDate(view.invoice.dueDate)}</div>
          <div><strong>Status:</strong> ${this.escapeHtml(view.invoice.status)}</div>
        </td>
      </tr>
    </table>

    <table class="header">
      <tr>
        <td style="width:50%; padding-right:16px;">
          <div class="block-title">Supplier</div>
          <div><strong>${this.escapeHtml(view.supplierName)}</strong></div>
          <div>${this.escapeHtml(view.supplierCountry)}</div>
        </td>
        <td style="width:50%;">
          <div class="block-title">Bill To</div>
          <div><strong>${this.escapeHtml(view.buyerName)}</strong></div>
          <div>${this.escapeHtml(view.buyerAddress || '-')}</div>
        </td>
      </tr>
    </table>

    <table class="meta">
      <tr>
        <th>PO Number</th>
        <th>Delivery Note</th>
        <th>Currency</th>
        <th>Payment Terms</th>
      </tr>
      <tr>
        <td>${this.escapeHtml(view.poNumber)}</td>
        <td>${this.escapeHtml(view.deliveryNoteNumber)}</td>
        <td>${this.escapeHtml(view.currency)}</td>
        <td>${this.escapeHtml(view.invoice.purchaseOrder.terms ?? '-')}</td>
      </tr>
    </table>

    <table class="items">
      <tr>
        <th style="width:60px;">#</th>
        <th>Description</th>
        <th style="width:100px;">Quantity</th>
        <th style="width:120px;">UOM</th>
      </tr>
      ${lineRows}
    </table>

    <table class="totals">
      <tr><td>Subtotal</td><td>${this.formatMoney(view.subtotal, view.currency)}</td></tr>
      <tr><td>Tax (${view.taxRatePercent ?? 0}%)</td><td>${this.formatMoney(view.taxAmount, view.currency)}</td></tr>
      <tr><td>Total</td><td>${this.formatMoney(view.totalAmount, view.currency)}</td></tr>
    </table>

    <div class="block-title">Notes</div>
    <div>${this.escapeHtml(view.invoice.notes || '-')}</div>
  </body>
</html>`;
  }

  private async renderInvoicePdfBuffer(view: Awaited<ReturnType<FinanceService['buildInvoiceViewModel']>>) {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(24).text('Invoice', { align: 'left' });
    doc.moveDown(0.25);
    doc.fontSize(10).fillColor('#475569').text('Supplier-issued procurement invoice');
    doc.moveDown();
    doc.fillColor('#0f172a').fontSize(11);
    doc.text(`Invoice #: ${view.invoice.invoiceNumber}`);
    doc.text(`Invoice Date: ${this.formatDate(view.invoice.issueDate)}`);
    doc.text(`Due Date: ${this.formatDate(view.invoice.dueDate)}`);
    doc.text(`Status: ${view.invoice.status}`);

    doc.moveDown();
    doc.fontSize(12).text('Supplier', { underline: true });
    doc.fontSize(10).text(view.supplierName);
    doc.text(view.supplierCountry);

    doc.moveDown();
    doc.fontSize(12).text('Bill To', { underline: true });
    doc.fontSize(10).text(view.buyerName);
    doc.text(view.buyerAddress || '-');

    doc.moveDown();
    doc.fontSize(10);
    doc.text(`PO Number: ${view.poNumber}`);
    doc.text(`Delivery Note: ${view.deliveryNoteNumber}`);
    doc.text(`Payment Terms: ${view.invoice.purchaseOrder.terms ?? '-'}`);
    doc.text(`Currency: ${view.currency}`);

    doc.moveDown();
    doc.fontSize(12).text('Line Items', { underline: true });
    doc.moveDown(0.5);
    if (view.prLines.length) {
      view.prLines.forEach((line, index) => {
        doc.fontSize(10).text(`${index + 1}. ${line.description} | Qty ${line.quantity} | UOM ${line.uom ?? '-'}`);
      });
    } else {
      doc.fontSize(10).text('1. PO commercial commitment | Qty 1 | UOM Lot');
    }

    doc.moveDown();
    doc.fontSize(12).text('Totals', { underline: true });
    doc.fontSize(10).text(`Subtotal: ${this.formatMoney(view.subtotal, view.currency)}`);
    doc.text(`Tax (${view.taxRatePercent ?? 0}%): ${this.formatMoney(view.taxAmount, view.currency)}`);
    doc.text(`Total: ${this.formatMoney(view.totalAmount, view.currency)}`);

    doc.moveDown();
    doc.fontSize(12).text('Notes', { underline: true });
    doc.fontSize(10).text(view.invoice.notes || '-');

    doc.end();
    return done;
  }

  private async storeInvoiceFile(invoiceId: string, kind: 'source' | 'signed', file?: UploadedBinary) {
    if (!file) return null;
    await mkdir(this.uploadsDir, { recursive: true });
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedName = `${invoiceId}-${kind}-${Date.now()}-${safeName}`;
    const storedPath = join(this.uploadsDir, storedName);
    await writeFile(storedPath, file.buffer);
    return { path: storedPath, name: safeName };
  }

  private async storeDeliveryNoteFile(deliveryNoteId: string, file?: UploadedBinary) {
    if (!file) return null;
    await mkdir(this.deliveryUploadsDir, { recursive: true });
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedName = `${deliveryNoteId}-${Date.now()}-${safeName}`;
    const storedPath = join(this.deliveryUploadsDir, storedName);
    await writeFile(storedPath, file.buffer);
    return { path: storedPath, name: safeName };
  }

  private async storePaymentProofFile(invoiceId: string, file?: UploadedBinary) {
    if (!file) return null;
    await mkdir(this.paymentProofUploadsDir, { recursive: true });
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedName = `${invoiceId}-${Date.now()}-${safeName}`;
    const storedPath = join(this.paymentProofUploadsDir, storedName);
    await writeFile(storedPath, file.buffer);
    return { path: storedPath, name: safeName };
  }

  private async getScopedDeliveryNote(ctx: any, deliveryNoteId: string) {
    const supplierId = this.requireSupplierId(ctx);
    const note = await this.prisma.deliveryNote.findFirst({
      where: {
        id: deliveryNoteId,
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        ...(supplierId ? { supplierId } : {}),
      },
    });
    if (!note) throw new NotFoundException('Delivery note not found');
    return note;
  }

  private resolveSystem(system?: 'ERP' | 'QUICKBOOKS' | 'MANUAL'): InvoiceSourceSystem {
    if (!system) return 'MANUAL';
    return system;
  }

  private async loadAdapterSnapshots(ctx: any, dto: SyncInvoicesDto): Promise<AdapterInvoiceSnapshot[]> {
    const system = dto.sourceSystem ?? 'MANUAL';
    if (system === 'MANUAL') return [];
    if (system === 'QUICKBOOKS') {
      return this.quickBooks.fetchInvoiceSnapshots({
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        since: dto.since,
      });
    }
    // ERP adapter interface baseline. Return empty until integrated.
    return [];
  }

  async syncInvoiceSnapshots(ctx: any, dto: SyncInvoicesDto) {
    const sourceSystem = this.resolveSystem(dto.sourceSystem);
    const manualSnapshots = (dto.snapshots ?? []).map((s) => ({ ...s }));
    const adapterSnapshots = manualSnapshots.length ? [] : await this.loadAdapterSnapshots(ctx, dto);
    const snapshots = manualSnapshots.length ? manualSnapshots : adapterSnapshots;

    let created = 0;
    let updated = 0;

    for (const item of snapshots) {
      const existing = await this.prisma.invoiceSnapshot.findUnique({
        where: {
          tenantId_companyId_externalInvoiceId: {
            tenantId: ctx.tenantId,
            companyId: ctx.companyId,
            externalInvoiceId: item.externalInvoiceId,
          },
        },
        select: { id: true },
      });

      let poId: string | undefined = item.poId;
      let poNumber: string | undefined = item.poNumber;

      if (poId) {
        const po = await this.getScopedPO(ctx, poId);
        poNumber = poNumber ?? po.poNumber;
      }

      await this.prisma.invoiceSnapshot.upsert({
        where: {
          tenantId_companyId_externalInvoiceId: {
            tenantId: ctx.tenantId,
            companyId: ctx.companyId,
            externalInvoiceId: item.externalInvoiceId,
          },
        },
        create: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          externalInvoiceId: item.externalInvoiceId,
          invoiceNumber: item.invoiceNumber,
          sourceSystem,
          poId,
          poNumber,
          currency: item.currency ?? 'ZAR',
          totalAmount: new Prisma.Decimal(item.totalAmount),
          invoiceDate: item.invoiceDate ? new Date(item.invoiceDate) : undefined,
          status: item.status,
          rawPayload: item,
          syncedAt: new Date(),
        },
        update: {
          invoiceNumber: item.invoiceNumber,
          sourceSystem,
          poId,
          poNumber,
          currency: item.currency ?? 'ZAR',
          totalAmount: new Prisma.Decimal(item.totalAmount),
          invoiceDate: item.invoiceDate ? new Date(item.invoiceDate) : undefined,
          status: item.status,
          rawPayload: item,
          syncedAt: new Date(),
        },
      });

      if (existing) updated += 1;
      else created += 1;
    }

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: 'dev-user',
      eventType: 'FINANCE_INVOICE_SNAPSHOTS_SYNCED',
      entityType: 'InvoiceSnapshot',
      payload: {
        sourceSystem,
        processed: snapshots.length,
        created,
        updated,
      },
    });

    return {
      sourceSystem,
      processed: snapshots.length,
      created,
      updated,
    };
  }

  async listInvoiceSnapshots(ctx: any, poId?: string, limit = 50) {
    if (poId) {
      await this.getScopedPO(ctx, poId);
    }

    return this.prisma.invoiceSnapshot.findMany({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        ...(poId ? { poId } : {}),
      },
      orderBy: { syncedAt: 'desc' },
      take: Math.max(1, Math.min(limit, 200)),
    });
  }

  async validatePOInvoices(ctx: any, poId: string) {
    const po = await this.getScopedPO(ctx, poId);

    const invoices = await this.prisma.invoiceSnapshot.findMany({
      where: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        OR: [{ poId: po.id }, { poNumber: po.poNumber }],
      },
      orderBy: { invoiceDate: 'asc' },
    });

    let totalInvoiced = new Prisma.Decimal(0);
    for (const invoice of invoices) {
      totalInvoiced = totalInvoiced.add(invoice.totalAmount);
    }

    const variance = totalInvoiced.sub(po.committedAmount);
    const varianceAbs = Math.abs(Number(variance));

    let matchStatus: InvoiceMatchStatus = 'MISSING_INVOICE';
    if (invoices.length > 0) {
      const cmp = totalInvoiced.comparedTo(po.committedAmount);
      if (cmp === 0) matchStatus = 'MATCH';
      else if (cmp < 0) matchStatus = 'UNDER_INVOICED';
      else matchStatus = 'OVER_INVOICED';
    }

    const serviceFamily = po.pr?.subcategoryId
      ? await this.rules.resolveServiceFamily(po.pr.subcategoryId)
      : 'PROJECT';
    const familyInvoiceHooks = this.rules.getInvoiceHooks(serviceFamily, varianceAbs);

    const result = {
      poId: po.id,
      poNumber: po.poNumber,
      poStatus: po.status,
      currency: po.currency,
      committedAmount: po.committedAmount,
      invoiceCount: invoices.length,
      totalInvoiced,
      varianceAmount: variance,
      matchStatus,
      serviceFamily,
      familyInvoiceHooks,
      invoices,
    };

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: 'dev-user',
      eventType: 'PO_INVOICE_VALIDATION_RUN',
      entityType: 'PurchaseOrder',
      entityId: po.id,
      payload: {
        invoiceCount: invoices.length,
        matchStatus,
        varianceAmount: Number(variance),
        serviceFamily,
        familyInvoiceHooks,
      },
    });

    return result;
  }

  async createDeliveryNote(ctx: any, poId: string, dto: CreateDeliveryNoteDto, file?: UploadedBinary) {
    this.assertInternalOnly(ctx, 'Delivery note upload');
    const po = await this.getScopedPO(ctx, poId);
    const supplierId = dto.supplierId?.trim() || po.award?.supplierId;
    if (!supplierId) throw new BadRequestException('supplierId is required');

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenantId: ctx.tenantId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!supplier) throw new BadRequestException('Supplier not found in tenant scope');

    const noteNumber =
      dto.noteNumber?.trim() ||
      `DN-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${po.poNumber.slice(-4)}`;

    const createdDelivery = await this.prisma.deliveryNote.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        poId: po.id,
        supplierId,
        noteNumber,
        deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : new Date(),
        receivedBy: dto.receivedBy,
        remarks: dto.remarks,
        documentUrl: dto.documentUrl,
      },
    });

    const stored = await this.storeDeliveryNoteFile(createdDelivery.id, file);
    const delivery = stored
      ? await this.prisma.deliveryNote.update({
          where: { id: createdDelivery.id },
          data: {
            documentPath: stored.path,
            documentName: stored.name,
          },
        })
      : createdDelivery;

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'DELIVERY_NOTE_CREATED',
      entityType: 'DeliveryNote',
      entityId: delivery.id,
      payload: {
        poId: po.id,
        noteNumber: delivery.noteNumber,
        documentName: delivery.documentName,
      },
    });

    return delivery;
  }

  async listDeliveryNotes(ctx: any, poId: string) {
    await this.getScopedPO(ctx, poId);
    return this.prisma.deliveryNote.findMany({
      where: { tenantId: ctx.tenantId, companyId: ctx.companyId, poId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async downloadDeliveryNoteDocument(ctx: any, deliveryNoteId: string, res: Response) {
    const note = await this.getScopedDeliveryNote(ctx, deliveryNoteId);
    if (!note.documentPath || !note.documentName) {
      throw new NotFoundException('Delivery note document not found');
    }
    const file = await readFile(note.documentPath);
    res.setHeader('content-type', 'application/octet-stream');
    res.setHeader('content-disposition', `attachment; filename="${note.documentName}"`);
    res.send(file);
  }

  async createInvoiceFromTemplate(ctx: any, poId: string, dto: CreateInvoiceFromTemplateDto) {
    this.assertInternalOnly(ctx, 'Organisation invoice creation');
    const po = await this.getScopedPO(ctx, poId);
    const deliveryNotes = await this.prisma.deliveryNote.findMany({
      where: { tenantId: ctx.tenantId, companyId: ctx.companyId, poId: po.id },
      orderBy: { createdAt: 'desc' },
    });
    if (deliveryNotes.length < 1) {
      throw new BadRequestException('At least one delivery note is required before creating an invoice');
    }

    const deliveryNoteId = dto.deliveryNoteId || deliveryNotes[0].id;
    const selectedNote = deliveryNotes.find((n) => n.id === deliveryNoteId);
    if (!selectedNote) {
      throw new BadRequestException('deliveryNoteId is invalid for this PO');
    }

    const taxIncluded = dto.taxIncluded ?? true;
    const rate = (dto.taxRatePercent ?? 15) / 100;
    const base = new Prisma.Decimal(po.committedAmount);
    const taxAmount = taxIncluded ? base.mul(new Prisma.Decimal(rate)) : new Prisma.Decimal(0);
    const totalAmount = taxIncluded ? base.add(taxAmount) : base;

    const issueDate = new Date();
    const invoiceNumber =
      dto.invoiceNumber?.trim() ||
      `INV-${issueDate.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${po.poNumber.slice(-4)}`;

    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        poId: po.id,
        supplierId: selectedNote.supplierId,
        deliveryNoteId: selectedNote.id,
        invoiceNumber,
        templateVersion: 'v1',
        currency: po.currency,
        subtotal: base,
        taxAmount,
        totalAmount,
        taxIncluded,
        issueDate,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: 'DRAFT',
        buyerDetails: {
          companyId: po.companyId,
          tenantId: po.tenantId,
          poNumber: po.poNumber,
        },
        supplierDetails: {
          supplierId: po.award?.supplierId ?? selectedNote.supplierId,
          supplierName: po.award?.supplier?.name ?? null,
          supplierEmail: po.award?.supplier?.email ?? null,
          supplierCountry: po.award?.supplier?.country ?? null,
        },
        lineItems: [
          {
            poNumber: po.poNumber,
            description: `Invoice against PO ${po.poNumber}`,
            amount: Number(base),
            currency: po.currency,
          },
        ],
        notes: dto.notes,
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'INVOICE_CREATED_FROM_TEMPLATE',
      entityType: 'Invoice',
      entityId: invoice.id,
      payload: {
        poId: po.id,
        deliveryNoteId: selectedNote.id,
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: Number(invoice.totalAmount),
      },
    });

    return this.getScopedInvoice(ctx, invoice.id);
  }

  async createSupplierInvoice(ctx: any, poId: string, dto: CreateSupplierInvoiceDto, file?: UploadedBinary) {
    const supplierId = this.requireSupplierId(ctx);
    const po = await this.getScopedPO(ctx, poId);
    if (!['RELEASED', 'ACCEPTED', 'CHANGE_REQUESTED'].includes(po.status)) {
      throw new BadRequestException('Supplier invoice can only be created for RELEASED/ACCEPTED/CHANGE_REQUESTED POs');
    }

    const deliveryNotes = await this.prisma.deliveryNote.findMany({
      where: { tenantId: ctx.tenantId, companyId: ctx.companyId, poId: po.id },
      orderBy: { createdAt: 'desc' },
    });
    if (deliveryNotes.length < 1) {
      throw new BadRequestException('At least one delivery note is required before supplier invoice creation');
    }

    const deliveryNoteId = dto.deliveryNoteId || deliveryNotes[0].id;
    const selectedNote = deliveryNotes.find((note) => note.id === deliveryNoteId);
    if (!selectedNote) {
      throw new BadRequestException('deliveryNoteId is invalid for this PO');
    }
    if (supplierId && selectedNote.supplierId !== supplierId) {
      throw new BadRequestException('Delivery note supplier does not match the authenticated supplier');
    }

    const taxIncluded = dto.taxIncluded ?? true;
    const rate = (dto.taxRatePercent ?? 15) / 100;
    const base = new Prisma.Decimal(po.committedAmount);
    const taxAmount = taxIncluded ? base.mul(new Prisma.Decimal(rate)) : new Prisma.Decimal(0);
    const totalAmount = taxIncluded ? base.add(taxAmount) : base;
    const issueDate = new Date();
    const invoiceNumber =
      dto.invoiceNumber?.trim() ||
      `INV-${issueDate.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${po.poNumber.slice(-4)}`;

    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        poId: po.id,
        supplierId: selectedNote.supplierId,
        deliveryNoteId: selectedNote.id,
        invoiceNumber,
        templateVersion: 'supplier-v1',
        currency: po.currency,
        subtotal: base,
        taxAmount,
        totalAmount,
        taxIncluded,
        issueDate,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: 'DRAFT',
        buyerDetails: {
          companyId: po.companyId,
          tenantId: po.tenantId,
          poNumber: po.poNumber,
        },
        supplierDetails: {
          supplierId: po.award?.supplierId ?? selectedNote.supplierId,
          supplierName: po.award?.supplier?.name ?? null,
          supplierEmail: po.award?.supplier?.email ?? null,
          supplierCountry: po.award?.supplier?.country ?? null,
        },
        lineItems: [
          {
            poNumber: po.poNumber,
            description: `Supplier invoice against PO ${po.poNumber}`,
            amount: Number(base),
            currency: po.currency,
          },
        ],
        notes: dto.notes,
      },
    });

    const stored = await this.storeInvoiceFile(invoice.id, 'source', file);
    if (stored) {
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          sourceDocumentPath: stored.path,
          sourceDocumentName: stored.name,
        },
      });
    }

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'SUPPLIER_INVOICE_CREATED',
      entityType: 'Invoice',
      entityId: invoice.id,
      payload: {
        poId: po.id,
        invoiceNumber,
        deliveryNoteId: selectedNote.id,
        sourceDocumentName: stored?.name ?? null,
      },
    });

    return this.getScopedInvoice(ctx, invoice.id);
  }

  async listLiveInvoices(ctx: any, poId: string) {
    await this.getScopedPO(ctx, poId);
    return this.prisma.invoice.findMany({
      where: { tenantId: ctx.tenantId, companyId: ctx.companyId, poId },
      include: {
        deliveryNote: true,
        signature: true,
        paymentProofs: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInvoice(ctx: any, invoiceId: string) {
    return this.getScopedInvoice(ctx, invoiceId);
  }

  async submitSupplierInvoice(ctx: any, invoiceId: string, dto: SubmitSupplierInvoiceDto) {
    this.requireSupplierId(ctx);
    const invoice = await this.getScopedInvoice(ctx, invoiceId);
    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException('Only draft supplier invoices can be submitted to organisation');
    }

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'SUBMITTED_TO_ORG',
        submittedAt: new Date(),
        submittedBy: ctx.userId ?? 'dev-user',
        notes: dto.notes ?? invoice.notes,
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'SUPPLIER_INVOICE_SUBMITTED',
      entityType: 'Invoice',
      entityId: invoice.id,
      payload: {
        poId: invoice.poId,
        invoiceNumber: invoice.invoiceNumber,
      },
    });

    return this.getScopedInvoice(ctx, invoice.id);
  }

  async reviewInvoice(ctx: any, invoiceId: string, dto: ReviewInvoiceDto) {
    this.assertInternalOnly(ctx, 'Invoice review');
    const invoice = await this.getScopedInvoice(ctx, invoiceId);
    if (!['SUBMITTED_TO_ORG', 'UNDER_REVIEW'].includes(invoice.status)) {
      throw new BadRequestException('Only submitted invoices can be moved into organisation review');
    }

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'UNDER_REVIEW',
        reviewedAt: new Date(),
        reviewedBy: ctx.userId ?? 'dev-user',
        notes: dto.notes ?? invoice.notes,
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'INVOICE_UNDER_REVIEW',
      entityType: 'Invoice',
      entityId: invoice.id,
      payload: {
        poId: invoice.poId,
        invoiceNumber: invoice.invoiceNumber,
      },
    });

    return this.getScopedInvoice(ctx, invoice.id);
  }

  async markInvoicePaid(ctx: any, invoiceId: string, dto: MarkInvoicePaidDto, file?: UploadedBinary) {
    this.assertInternalOnly(ctx, 'Invoice payment confirmation');
    const invoice = await this.getScopedInvoice(ctx, invoiceId);
    if (!['SIGNED', 'PAID'].includes(invoice.status)) {
      throw new BadRequestException('Invoice must be SIGNED before payment posting');
    }

    const amountPaid = new Prisma.Decimal(dto.amountPaid ?? invoice.totalAmount);
    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();
    const stored = await this.storePaymentProofFile(invoice.id, file);

    const updated = await this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'PAID',
          paidAt: paymentDate,
        },
      });

      await tx.paymentProof.create({
        data: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          invoiceId: invoice.id,
          amountPaid,
          paymentDate,
          paymentReference: dto.paymentReference,
          popUrl: dto.popUrl,
          popPath: stored?.path,
          popName: stored?.name,
          notes: dto.notes,
          recordedBy: ctx.userId ?? 'dev-user',
        },
      });

      return inv;
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'INVOICE_PAYMENT_POSTED',
      entityType: 'Invoice',
      entityId: invoice.id,
      payload: {
        amountPaid: Number(amountPaid),
        paymentReference: dto.paymentReference ?? null,
        popUrl: dto.popUrl ?? null,
        popName: stored?.name ?? null,
      },
    });

    return this.getScopedInvoice(ctx, updated.id);
  }

  async signInvoice(ctx: any, invoiceId: string, dto: SignInvoiceDto) {
    this.assertInternalOnly(ctx, 'Invoice signing');
    const invoice = await this.getScopedInvoice(ctx, invoiceId);
    if (!['UNDER_REVIEW', 'SIGNED', 'PAID'].includes(invoice.status)) {
      throw new BadRequestException('Invoice must be UNDER_REVIEW before digital signing');
    }

    const signerName = dto.signerName?.trim() || (ctx.userId ?? 'dev-user');
    const signerRole = dto.signerRole?.trim() || 'FINANCE_APPROVER';
    const signatureHash =
      dto.signatureHash?.trim() ||
      createHash('sha256')
        .update(`${invoice.id}|${invoice.invoiceNumber}|${signerName}|${new Date().toISOString()}`)
        .digest('hex');

    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: invoice.status === InvoiceLifecycleStatus.PAID ? 'PAID' : 'SIGNED',
          signedAt: new Date(),
        },
      });

      await tx.invoiceSignature.upsert({
        where: { invoiceId: invoice.id },
        create: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          invoiceId: invoice.id,
          signedBy: signerName,
          signerRole,
          signatureHash,
          signaturePayload: {
            method: 'system-digital-signature',
            signedAt: new Date().toISOString(),
          },
        },
        update: {
          signedBy: signerName,
          signerRole,
          signatureHash,
          signaturePayload: {
            method: 'system-digital-signature',
            signedAt: new Date().toISOString(),
          },
        },
      });
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: signerName,
      eventType: 'INVOICE_SIGNED_DIGITALLY',
      entityType: 'Invoice',
      entityId: invoice.id,
      payload: { signerRole, signatureHash },
    });

    return this.getScopedInvoice(ctx, invoice.id);
  }

  async uploadSignedInvoice(ctx: any, invoiceId: string, file?: UploadedBinary) {
    this.assertInternalOnly(ctx, 'Signed invoice upload');
    const invoice = await this.getScopedInvoice(ctx, invoiceId);
    if (!['UNDER_REVIEW', 'SIGNED', 'PAID'].includes(invoice.status)) {
      throw new BadRequestException('Invoice must be UNDER_REVIEW before uploading a signed copy');
    }

    const stored = await this.storeInvoiceFile(invoice.id, 'signed', file);
    if (!stored) {
      throw new BadRequestException('Signed invoice file is required');
    }

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        signedDocumentPath: stored.path,
        signedDocumentName: stored.name,
        signedAt: new Date(),
        status: invoice.status === InvoiceLifecycleStatus.PAID ? 'PAID' : 'SIGNED',
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'INVOICE_SIGNED_COPY_UPLOADED',
      entityType: 'Invoice',
      entityId: invoice.id,
      payload: {
        invoiceNumber: invoice.invoiceNumber,
        signedDocumentName: stored.name,
      },
    });

    return this.getScopedInvoice(ctx, invoice.id);
  }

  async downloadInvoiceDocument(ctx: any, invoiceId: string, kind: 'source' | 'signed', res: Response) {
    const invoice = await this.getScopedInvoice(ctx, invoiceId);
    const filePath = kind === 'signed' ? invoice.signedDocumentPath : invoice.sourceDocumentPath;
    const fileName = kind === 'signed' ? invoice.signedDocumentName : invoice.sourceDocumentName;
    if (!filePath || !fileName) {
      if (kind === 'signed') {
        throw new NotFoundException('signed invoice document not found');
      }

      const generatedName = `${invoice.invoiceNumber || invoice.id}-system-invoice.txt`;
      const generatedBody = [
        `Invoice Number: ${invoice.invoiceNumber}`,
        `Status: ${invoice.status}`,
        `Currency: ${invoice.currency}`,
        `Total Amount: ${invoice.totalAmount.toString()}`,
        `PO Number: ${invoice.purchaseOrder?.poNumber ?? '-'}`,
        `Supplier: ${invoice.supplier?.name ?? '-'}`,
        `Submitted At: ${invoice.submittedAt?.toISOString() ?? '-'}`,
        `Reviewed At: ${invoice.reviewedAt?.toISOString() ?? '-'}`,
        `Signed At: ${invoice.signedAt?.toISOString() ?? '-'}`,
        `Notes: ${invoice.notes ?? '-'}`,
      ].join('\n');
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${generatedName}"`);
      res.send(Buffer.from(generatedBody, 'utf8'));
      return;
    }
    const fileBuffer = await readFile(filePath);
    res.setHeader('content-type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(fileBuffer);
  }

  async previewInvoiceDocument(ctx: any, invoiceId: string, res: Response) {
    const view = await this.buildInvoiceViewModel(ctx, invoiceId);
    const html = this.renderInvoiceHtml(view);
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.send(html);
  }

  async downloadInvoicePdf(ctx: any, invoiceId: string, res: Response) {
    const view = await this.buildInvoiceViewModel(ctx, invoiceId);
    const pdf = await this.renderInvoicePdfBuffer(view);
    const fileName = `${view.invoice.invoiceNumber || view.invoice.id}.pdf`;
    res.setHeader('content-type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdf);
  }
}
