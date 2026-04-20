import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCustomSubcategoryDto {
  @IsString()
  @IsNotEmpty()
  level1!: string;

  @IsString()
  @IsNotEmpty()
  level2!: string;

  @IsString()
  @IsNotEmpty()
  level3!: string;

  @IsOptional()
  @IsString()
  baseSubcategoryId?: string;
}
