import { IsArray, IsIn, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertBidDto {
  @IsString()
  @IsNotEmpty()
  rfqId!: string;

  @IsString()
  @IsNotEmpty()
  supplierId!: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  documents?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalBidValue?: number;
}

export class EvaluateBidCriterionDto {
  @IsIn(['PRICE', 'DELIVERY', 'COMPLIANCE', 'RISK'])
  criterion!: 'PRICE' | 'DELIVERY' | 'COMPLIANCE' | 'RISK';

  @IsNumber()
  @Min(0)
  @Max(100)
  score!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class EvaluateBidDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvaluateBidCriterionDto)
  criteria!: EvaluateBidCriterionDto[];

  @IsOptional()
  @IsString()
  summary?: string;
}

export class RecommendBidDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class BidStatusDto {
  @IsIn(['SHORTLISTED', 'REJECTED', 'CLOSED'])
  status!: 'SHORTLISTED' | 'REJECTED' | 'CLOSED';

  @IsOptional()
  @IsString()
  reason?: string;
}
