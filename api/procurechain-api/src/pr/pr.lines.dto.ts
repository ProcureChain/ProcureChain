import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AddLineDto {
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsNumber()
  @Min(0.000001)
  quantity?: number;

  @IsOptional()
  @IsString()
  uom?: string;

  @IsOptional()
  @IsString()
  notes?: string;

}
