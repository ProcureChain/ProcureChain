import { IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min, ValidateIf } from 'class-validator';
import { ProcurementMethod, SoDAction } from '@prisma/client';

export class UpdateProcurementPolicyDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  lowThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  midThreshold?: number;

  @IsOptional()
  @IsEnum(ProcurementMethod)
  lowMethod?: ProcurementMethod;

  @IsOptional()
  @IsEnum(ProcurementMethod)
  midMethod?: ProcurementMethod;

  @IsOptional()
  @IsEnum(ProcurementMethod)
  highMethod?: ProcurementMethod;

  @IsOptional()
  @IsEnum(ProcurementMethod)
  emergencyMethod?: ProcurementMethod;

  @IsOptional()
  @IsBoolean()
  emergencyEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  requireEmergencyJustification?: boolean;
}

export class ResolveProcurementMethodDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetAmount?: number;

  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;

  @IsOptional()
  @IsEnum(ProcurementMethod)
  requestedMethod?: ProcurementMethod;

  @ValidateIf((v: ResolveProcurementMethodDto) => v.isEmergency === true)
  @IsString()
  emergencyJustification?: string;
}

export class UpdateSoDRuleDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedRoles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blockedRoles?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export const SOD_ACTIONS = Object.values(SoDAction);
