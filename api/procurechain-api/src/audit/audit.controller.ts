import { Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { TenantGuard } from '../common/tenant.guard';

@Controller('audit')
@UseGuards(TenantGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Post('test')
  async test(@Req() req: any) {
    return this.audit.record({
      tenantId: req.ctx.tenantId,
      companyId: req.ctx.companyId,
      actor: req.ctx.userId ?? 'dev-user',
      eventType: 'TEST_EVENT',
      entityType: 'System',
      entityId: 'health',
      payload: { note: 'Audit test event' },
    });
  }

  @Get('events')
  async events(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.audit.list(req.ctx.tenantId, req.ctx.companyId, {
      limit: limit ? Number(limit) : 50,
      entityType,
      entityId,
    });
  }
}
