import { Body, Controller, Get, Param, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantGuard } from '../common/tenant.guard';
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
import { FinanceService } from './finance.service';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

type UploadedBinary = {
  originalname: string;
  buffer: Buffer;
};

@Controller('finance')
@UseGuards(TenantGuard)
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Post('invoices/sync')
  syncInvoices(@Req() req: any, @Body() dto: SyncInvoicesDto) {
    return this.finance.syncInvoiceSnapshots(req.ctx, dto);
  }

  @Get('invoices')
  listInvoices(@Req() req: any, @Query('poId') poId?: string, @Query('limit') limit?: string) {
    return this.finance.listInvoiceSnapshots(req.ctx, poId, limit ? Number(limit) : 50);
  }

  @Get('po/:poId/validation')
  validatePO(@Req() req: any, @Param('poId') poId: string) {
    return this.finance.validatePOInvoices(req.ctx, poId);
  }

  @Post('po/:poId/delivery-notes')
  @UseInterceptors(FileInterceptor('file'))
  createDeliveryNote(
    @Req() req: any,
    @Param('poId') poId: string,
    @Body() dto: CreateDeliveryNoteDto,
    @UploadedFile() file?: UploadedBinary,
  ) {
    return this.finance.createDeliveryNote(req.ctx, poId, dto, file);
  }

  @Get('po/:poId/delivery-notes')
  listDeliveryNotes(@Req() req: any, @Param('poId') poId: string) {
    return this.finance.listDeliveryNotes(req.ctx, poId);
  }

  @Get('delivery-notes/:deliveryNoteId/document')
  downloadDeliveryNoteDocument(@Req() req: any, @Param('deliveryNoteId') deliveryNoteId: string, @Res() res: Response) {
    return this.finance.downloadDeliveryNoteDocument(req.ctx, deliveryNoteId, res);
  }

  @Post('po/:poId/invoices/from-template')
  createInvoiceFromTemplate(@Req() req: any, @Param('poId') poId: string, @Body() dto: CreateInvoiceFromTemplateDto) {
    return this.finance.createInvoiceFromTemplate(req.ctx, poId, dto);
  }

  @Post('po/:poId/invoices/supplier')
  @UseInterceptors(FileInterceptor('file'))
  createSupplierInvoice(
    @Req() req: any,
    @Param('poId') poId: string,
    @Body() dto: CreateSupplierInvoiceDto,
    @UploadedFile() file?: UploadedBinary,
  ) {
    return this.finance.createSupplierInvoice(req.ctx, poId, dto, file);
  }

  @Get('po/:poId/invoices/live')
  listLiveInvoices(@Req() req: any, @Param('poId') poId: string) {
    return this.finance.listLiveInvoices(req.ctx, poId);
  }

  @Get('invoices/live/:invoiceId')
  getLiveInvoice(@Req() req: any, @Param('invoiceId') invoiceId: string) {
    return this.finance.getInvoice(req.ctx, invoiceId);
  }

  @Post('invoices/live/:invoiceId/submit')
  submitSupplierInvoice(@Req() req: any, @Param('invoiceId') invoiceId: string, @Body() dto: SubmitSupplierInvoiceDto) {
    return this.finance.submitSupplierInvoice(req.ctx, invoiceId, dto);
  }

  @Post('invoices/live/:invoiceId/review')
  reviewInvoice(@Req() req: any, @Param('invoiceId') invoiceId: string, @Body() dto: ReviewInvoiceDto) {
    return this.finance.reviewInvoice(req.ctx, invoiceId, dto);
  }

  @Post('invoices/live/:invoiceId/mark-paid')
  @UseInterceptors(FileInterceptor('file'))
  markInvoicePaid(
    @Req() req: any,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: MarkInvoicePaidDto,
    @UploadedFile() file?: UploadedBinary,
  ) {
    return this.finance.markInvoicePaid(req.ctx, invoiceId, dto, file);
  }

  @Post('invoices/live/:invoiceId/sign')
  signInvoice(@Req() req: any, @Param('invoiceId') invoiceId: string, @Body() dto: SignInvoiceDto) {
    return this.finance.signInvoice(req.ctx, invoiceId, dto);
  }

  @Post('invoices/live/:invoiceId/upload-signed')
  @UseInterceptors(FileInterceptor('file'))
  uploadSignedInvoice(@Req() req: any, @Param('invoiceId') invoiceId: string, @UploadedFile() file?: UploadedBinary) {
    return this.finance.uploadSignedInvoice(req.ctx, invoiceId, file);
  }

  @Get('invoices/live/:invoiceId/document')
  downloadInvoiceDocument(
    @Req() req: any,
    @Param('invoiceId') invoiceId: string,
    @Query('kind') kind: 'source' | 'signed',
    @Res() res: Response,
  ) {
    return this.finance.downloadInvoiceDocument(req.ctx, invoiceId, kind, res);
  }

  @Get('invoices/live/:invoiceId/preview')
  previewInvoiceDocument(@Req() req: any, @Param('invoiceId') invoiceId: string, @Res() res: Response) {
    return this.finance.previewInvoiceDocument(req.ctx, invoiceId, res);
  }

  @Get('invoices/live/:invoiceId/pdf')
  downloadInvoicePdf(@Req() req: any, @Param('invoiceId') invoiceId: string, @Res() res: Response) {
    return this.finance.downloadInvoicePdf(req.ctx, invoiceId, res);
  }
}
