import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { TenantGuard } from '../common/tenant.guard';
import { OnboardingService } from './onboarding.service';
import {
  LoginDto,
  OrganizationSignupDto,
  SupplierSignupDto,
  UpdateOrganizationProfileDto,
  UploadOrganizationDocumentDto,
  UploadSupplierDocumentDto,
} from './onboarding.dto';

type UploadedBinary = {
  originalname: string;
  mimetype?: string;
  size?: number;
  buffer: Buffer;
};

@Controller()
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Post('auth/signup/organization')
  signupOrganization(@Body() dto: OrganizationSignupDto) {
    return this.onboarding.signupOrganization(dto);
  }

  @Post('auth/signup/supplier')
  signupSupplier(@Body() dto: SupplierSignupDto) {
    return this.onboarding.signupSupplier(dto);
  }

  @Post('auth/login')
  login(@Body() dto: LoginDto) {
    return this.onboarding.login(dto);
  }

  @Get('organization/profile')
  @UseGuards(TenantGuard)
  getOrganizationProfile(@Req() req: any) {
    return this.onboarding.getOrganizationProfile(req.ctx);
  }

  @Patch('organization/profile')
  @UseGuards(TenantGuard)
  updateOrganizationProfile(@Req() req: any, @Body() dto: UpdateOrganizationProfileDto) {
    return this.onboarding.updateOrganizationProfile(req.ctx, dto);
  }

  @Get('organization/documents')
  @UseGuards(TenantGuard)
  listOrganizationDocuments(@Req() req: any) {
    return this.onboarding.listOrganizationDocuments(req.ctx);
  }

  @Post('organization/documents')
  @UseGuards(TenantGuard)
  @UseInterceptors(FileInterceptor('file'))
  uploadOrganizationDocument(
    @Req() req: any,
    @Body() dto: UploadOrganizationDocumentDto,
    @UploadedFile() file?: UploadedBinary,
  ) {
    return this.onboarding.uploadOrganizationDocument(req.ctx, dto, file);
  }

  @Get('organization/documents/:documentId/download')
  @UseGuards(TenantGuard)
  downloadOrganizationDocument(
    @Req() req: any,
    @Param('documentId') documentId: string,
    @Res() res: Response,
  ) {
    return this.onboarding.downloadOrganizationDocument(req.ctx, documentId, res);
  }

  @Get('supplier/profile')
  @UseGuards(TenantGuard)
  getSupplierProfile(@Req() req: any) {
    return this.onboarding.getSupplierProfile(req.ctx);
  }

  @Get('supplier/documents')
  @UseGuards(TenantGuard)
  listSupplierDocuments(@Req() req: any) {
    return this.onboarding.listSupplierDocuments(req.ctx);
  }

  @Post('supplier/documents')
  @UseGuards(TenantGuard)
  @UseInterceptors(FileInterceptor('file'))
  uploadSupplierDocument(
    @Req() req: any,
    @Body() dto: UploadSupplierDocumentDto,
    @UploadedFile() file?: UploadedBinary,
  ) {
    return this.onboarding.uploadSupplierDocument(req.ctx, dto, file);
  }

  @Get('supplier/documents/:documentId/download')
  @UseGuards(TenantGuard)
  downloadSupplierDocument(
    @Req() req: any,
    @Param('documentId') documentId: string,
    @Res() res: Response,
  ) {
    return this.onboarding.downloadSupplierDocument(req.ctx, documentId, res);
  }
}
