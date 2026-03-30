import { ExportFormat, ExportType } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class GenerateExportDto {
  @IsOptional()
  @IsEnum(ExportFormat)
  format?: ExportFormat;
}

export class UpdateRetentionPolicyDto {
  @IsOptional()
  @IsInt()
  @Min(30)
  auditRetentionDays?: number;

  @IsOptional()
  @IsBoolean()
  enforceImmutability?: boolean;

  @IsOptional()
  @IsBoolean()
  allowPurge?: boolean;
}

export class RunRetentionDto {
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export const EXPORT_TYPES = Object.values(ExportType);
