import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { TenantGuard } from '../common/tenant.guard';
import { ClosePODto, CreatePOFromAwardDto, SupplierRespondPODto } from './po.dto';
import { POService } from './po.service';

@Controller('pos')
@UseGuards(TenantGuard)
export class POController {
  constructor(private readonly pos: POService) {}

  @Post('from-award')
  createFromAward(@Req() req: any, @Body() dto: CreatePOFromAwardDto) {
    return this.pos.createFromAward(req.ctx, dto);
  }

  @Get()
  list(@Req() req: any, @Query('limit') limit?: string) {
    return this.pos.list(req.ctx, limit ? Number(limit) : 50);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.pos.get(req.ctx, id);
  }

  @Post(':id/release')
  release(@Req() req: any, @Param('id') id: string) {
    return this.pos.release(req.ctx, id);
  }

  @Post(':id/respond')
  supplierRespond(@Req() req: any, @Param('id') id: string, @Body() dto: SupplierRespondPODto) {
    return this.pos.supplierRespond(req.ctx, id, dto);
  }

  @Post(':id/close')
  close(@Req() req: any, @Param('id') id: string, @Body() dto: ClosePODto) {
    return this.pos.close(req.ctx, id, dto);
  }
}
