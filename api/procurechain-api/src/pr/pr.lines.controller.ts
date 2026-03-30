import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { TenantGuard } from '../common/tenant.guard';
import { PRService } from './pr.service';
import { AddLineDto } from './pr.lines.dto';

@Controller('pr')
@UseGuards(TenantGuard)
export class PRLinesController {
  constructor(private readonly prs: PRService) {}

  @Post(':id/lines')
  addLine(@Req() req: any, @Param('id') prId: string, @Body() dto: AddLineDto) {
    return this.prs.addLine(req.ctx, prId, dto);
  }

  @Get(':id/lines')
  listLines(@Req() req: any, @Param('id') prId: string) {
    return this.prs.listLines(req.ctx, prId);
  }

  @Delete(':id/lines/:lineId')
  removeLine(@Req() req: any, @Param('id') prId: string, @Param('lineId') lineId: string) {
    return this.prs.removeLine(req.ctx, prId, lineId);
  }

  @Post(':id/recalculate')
  recalc(@Req() req: any, @Param('id') prId: string) {
    return this.prs.recalculateTotal(req.ctx, prId);
  }
}
