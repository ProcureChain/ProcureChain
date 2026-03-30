import { ProcurementMethod, RFQReleaseMode } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateRFQDto {
  @IsString()
  @IsNotEmpty()
  prId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsNumber()
  @Min(0)
  budgetAmount!: number;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsString()
  @IsNotEmpty()
  paymentTerms!: string;

  @IsBoolean()
  taxIncluded!: boolean;

  @IsInt()
  @Min(1)
  @Max(365)
  priceValidityDays!: number;

  @IsOptional()
  @IsEnum(ProcurementMethod)
  procurementMethod?: ProcurementMethod;

  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;

  @IsOptional()
  @IsString()
  emergencyJustification?: string;
}

export class AddRFQSuppliersDto {
  @IsArray()
  @IsString({ each: true })
  supplierIds!: string[];
}

export class AwardRFQDto {
  @IsString()
  @IsNotEmpty()
  bidId!: string;

  @IsString()
  @IsNotEmpty()
  supplierId!: string;

  @IsString()
  @IsNotEmpty()
  overrideReason!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CloseRFQDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  reason?: string;
}

export class ReleaseRFQDto {
  @IsOptional()
  @IsEnum(RFQReleaseMode)
  releaseMode?: RFQReleaseMode;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  localCountryCode?: string;
}

export class CreateSupplierFormTemplateDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  fields!: Array<{
    id?: string;
    key?: string;
    label?: string;
    type?: 'TEXT' | 'NUMBER' | 'DOCUMENT';
    required?: boolean;
  }>;

  @IsOptional()
  @IsBoolean()
  isReusable?: boolean;
}

export class AttachSupplierFormDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  templateId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  fields?: Array<{
    id?: string;
    key?: string;
    label?: string;
    type?: 'TEXT' | 'NUMBER' | 'DOCUMENT';
    required?: boolean;
  }>;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  saveForReuse?: boolean;
}
