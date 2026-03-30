import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { TenantGuard } from '../common/tenant.guard';
import { ComplianceService } from './compliance.service';
import { DeclareCOIDto, ReviewCOIDto } from './coi.dto';

@Controller('compliance')
@UseGuards(TenantGuard)
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Post('rfqs/:rfqId/coi')
  declare(@Req() req: any, @Param('rfqId') rfqId: string, @Body() dto: DeclareCOIDto) {
    return this.compliance.declareCOI(req.ctx, rfqId, dto);
  }

  @Get('rfqs/:rfqId/coi')
  list(@Req() req: any, @Param('rfqId') rfqId: string) {
    return this.compliance.listCOI(req.ctx, rfqId);
  }

  @Put('coi/:id/review')
  review(@Req() req: any, @Param('id') id: string, @Body() dto: ReviewCOIDto) {
    return this.compliance.reviewCOI(req.ctx, id, dto);
  }
}
