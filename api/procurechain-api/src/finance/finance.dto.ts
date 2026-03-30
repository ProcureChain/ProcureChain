import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class SyncInvoiceSnapshotItemDto {
  @IsString()
  @IsNotEmpty()
  externalInvoiceId!: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @IsString()
  poId?: string;

  @IsOptional()
  @IsString()
  poNumber?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsNumber()
  @Min(0)
  totalAmount!: number;

  @IsOptional()
  @IsString()
  invoiceDate?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class SyncInvoicesDto {
  @IsOptional()
  @IsString()
  @IsIn(['ERP', 'QUICKBOOKS', 'MANUAL'])
  sourceSystem?: 'ERP' | 'QUICKBOOKS' | 'MANUAL';

  @IsOptional()
  @IsString()
  since?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncInvoiceSnapshotItemDto)
  snapshots?: SyncInvoiceSnapshotItemDto[];
}

export class CreateDeliveryNoteDto {
  @IsOptional()
  @IsString()
  noteNumber?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  deliveryDate?: string;

  @IsOptional()
  @IsString()
  receivedBy?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  documentUrl?: string;
}

export class CreateInvoiceFromTemplateDto {
  @IsOptional()
  @IsString()
  deliveryNoteId?: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @IsBoolean()
  taxIncluded?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRatePercent?: number;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateSupplierInvoiceDto {
  @IsOptional()
  @IsString()
  deliveryNoteId?: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @IsBoolean()
  taxIncluded?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRatePercent?: number;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SubmitSupplierInvoiceDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReviewInvoiceDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class MarkInvoicePaidDto {
  @IsOptional()
  @IsString()
  paymentDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amountPaid?: number;

  @IsOptional()
  @IsString()
  paymentReference?: string;

  @IsOptional()
  @IsString()
  popUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SignInvoiceDto {
  @IsOptional()
  @IsString()
  signerName?: string;

  @IsOptional()
  @IsString()
  signerRole?: string;

  @IsOptional()
  @IsString()
  signatureHash?: string;
}
