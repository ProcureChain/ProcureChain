import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ExportType } from '@prisma/client';
import { TenantGuard } from '../common/tenant.guard';
import { EXPORT_TYPES, GenerateExportDto, RunRetentionDto, UpdateRetentionPolicyDto } from './governance.dto';
import { GovernanceService } from './governance.service';

@Controller('governance')
@UseGuards(TenantGuard)
export class GovernanceController {
  constructor(private readonly governance: GovernanceService) {}

  @Post('exports/:type')
  generateExport(@Req() req: any, @Param('type') type: string, @Body() dto: GenerateExportDto) {
    const exportType = type.toUpperCase() as ExportType;
    if (!EXPORT_TYPES.includes(exportType)) {
      throw new BadRequestException(`Invalid export type: ${type}`);
    }
    return this.governance.generateExport(req.ctx, exportType, dto.format ?? 'CSV');
  }

  @Get('exports')
  listExports(@Req() req: any, @Query('limit') limit?: string) {
    return this.governance.listExports(req.ctx, limit ? Number(limit) : 50);
  }

  @Get('retention/policy')
  getRetentionPolicy(@Req() req: any) {
    return this.governance.getRetentionPolicy(req.ctx);
  }

  @Put('retention/policy')
  updateRetentionPolicy(@Req() req: any, @Body() dto: UpdateRetentionPolicyDto) {
    return this.governance.updateRetentionPolicy(req.ctx, dto);
  }

  @Post('retention/run')
  runRetention(@Req() req: any, @Body() dto: RunRetentionDto) {
    return this.governance.runRetention(req.ctx, dto.dryRun ?? true);
  }

  @Get('retention/logs')
  listRetentionRuns(@Req() req: any, @Query('limit') limit?: string) {
    return this.governance.listRetentionRuns(req.ctx, limit ? Number(limit) : 50);
  }

  @Get('audit/evidence')
  verifyEvidence(@Req() req: any, @Query('limit') limit?: string) {
    return this.governance.verifyAuditEvidence(req.ctx, limit ? Number(limit) : 500);
  }
}
