import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePOFromAwardDto {
  @IsString()
  @IsNotEmpty()
  awardId!: string;

  @IsOptional()
  @IsString()
  terms?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SupplierRespondPODto {
  @IsString()
  @IsIn(['ACCEPT', 'REQUEST_CHANGE'])
  action!: 'ACCEPT' | 'REQUEST_CHANGE';

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  proposedTerms?: string;

  @IsOptional()
  @IsString()
  requestedBy?: string;
}

export class ClosePODto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  reason?: string;
}
