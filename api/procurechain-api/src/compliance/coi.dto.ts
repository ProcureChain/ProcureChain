import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DeclareCOIDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsString()
  supplierId?: string;
}

export class ReviewCOIDto {
  @IsIn(['APPROVED', 'BLOCKED'])
  decision!: 'APPROVED' | 'BLOCKED';

  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
