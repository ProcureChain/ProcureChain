import {
  ArrayMaxSize,
  MinLength,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class OrganizationSignupDto {
  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  companySize?: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsEmail()
  workEmail!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  monthlyProcurementSpendRange?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @IsString({ each: true })
  mainCategoriesPurchased?: string[];

  @IsOptional()
  @IsString()
  numberOfSuppliersCurrentlyUsed?: string;

  @IsOptional()
  @IsBoolean()
  usesProcurementSystemToday?: boolean;
}

export class UpdateOrganizationProfileDto {
  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  companySize?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEmail()
  workEmail?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  monthlyProcurementSpendRange?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @IsString({ each: true })
  mainCategoriesPurchased?: string[];

  @IsOptional()
  @IsString()
  numberOfSuppliersCurrentlyUsed?: string;

  @IsOptional()
  @IsBoolean()
  usesProcurementSystemToday?: boolean;

  @IsOptional()
  @IsIn(['PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED'])
  verificationStatus?: 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED';
}

export class UploadOrganizationDocumentDto {
  @IsString()
  @IsNotEmpty()
  fieldKey!: string;

  @IsOptional()
  @IsString()
  label?: string;
}

export class UploadSupplierDocumentDto {
  @IsString()
  @IsNotEmpty()
  fieldKey!: string;

  @IsOptional()
  @IsString()
  label?: string;
}

export class SupplierSignupDto {
  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  yearsInOperation?: number;

  @IsOptional()
  @IsString()
  numberOfEmployees?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  regionsServed?: string[];

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsEmail()
  workEmail!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @IsString({ each: true })
  categoryIds?: string[];

  @IsArray()
  @ArrayMaxSize(25)
  @IsString({ each: true })
  subcategoryIds!: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  completedProjects?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxOrderValue?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeDays?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  certifications?: string[];

  @IsOptional()
  @IsBoolean()
  hasQualityControlProcess?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  responseTimeHours?: number;

  @IsOptional()
  @IsBoolean()
  dedicatedAccountManager?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  onTimeDeliveryRate?: number;

  @IsOptional()
  @IsBoolean()
  disputeHistory?: boolean;

  @IsOptional()
  @IsIn(['PREMIUM', 'MARKET', 'BUDGET'])
  pricingPosition?: 'PREMIUM' | 'MARKET' | 'BUDGET';
}

export class LoginDto {
  @IsIn(['organization', 'supplier'])
  portal!: 'organization' | 'supplier';

  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
