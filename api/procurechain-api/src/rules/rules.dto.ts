import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class ValidatePayloadDto {
  @IsString()
  @IsNotEmpty()
  subcategoryId!: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsObject()
  payload!: Record<string, unknown>;
}

export class FamilyHooksDto {
  @IsString()
  @IsNotEmpty()
  subcategoryId!: string;

  @IsOptional()
  @IsString()
  @IsIn(['invoice', 'evaluation'])
  type?: 'invoice' | 'evaluation';

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
