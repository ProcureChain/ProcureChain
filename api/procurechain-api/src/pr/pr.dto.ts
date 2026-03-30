import { IsBoolean, IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreatePRDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  costCentre?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  subcategoryId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  validateRequired?: boolean;
}

export class UpdatePRStatusDto {
  @IsString()
  @IsIn([
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'RETURNED',
    'APPROVED',
    'CONVERTED_TO_RFQ',
    'CLOSED',
    'REJECTED',
  ])
  status!: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'RETURNED' | 'APPROVED' | 'CONVERTED_TO_RFQ' | 'CLOSED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  reason?: string;
}

export class UpdatePRDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  costCentre?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  subcategoryId?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  editSource?: string;

  @IsOptional()
  @IsBoolean()
  validateRequired?: boolean;
}

export class WithdrawPRDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  reason?: string;
}

export class CreatePRDocumentDto {
  @IsOptional()
  @IsString()
  fieldKey?: string;

  @IsOptional()
  @IsString()
  label?: string;
}
