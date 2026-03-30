import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { TenantGuard } from '../common/tenant.guard';
import { BidService } from './bid.service';
import { BidStatusDto, EvaluateBidDto, RecommendBidDto, UpsertBidDto } from './bid.dto';

@Controller('bids')
@UseGuards(TenantGuard)
export class BidController {
  constructor(private readonly bids: BidService) {}

  @Post()
  upsert(@Req() req: any, @Body() dto: UpsertBidDto) {
    return this.bids.upsertDraft(req.ctx, dto);
  }

  @Get('rfq/:rfqId')
  listByRfq(@Req() req: any, @Param('rfqId') rfqId: string) {
    return this.bids.listByRfq(req.ctx, rfqId);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.bids.get(req.ctx, id);
  }

  @Post(':id/submit')
  submit(@Req() req: any, @Param('id') id: string) {
    return this.bids.submit(req.ctx, id);
  }

  @Post(':id/open')
  open(@Req() req: any, @Param('id') id: string) {
    return this.bids.open(req.ctx, id);
  }

  @Post(':id/evaluate')
  evaluate(@Req() req: any, @Param('id') id: string, @Body() dto: EvaluateBidDto) {
    return this.bids.evaluate(req.ctx, id, dto);
  }

  @Post(':id/recommend')
  recommend(@Req() req: any, @Param('id') id: string, @Body() dto: RecommendBidDto) {
    return this.bids.recommend(req.ctx, id, dto);
  }

  @Post(':id/status')
  transition(@Req() req: any, @Param('id') id: string, @Body() dto: BidStatusDto) {
    return this.bids.transition(req.ctx, id, dto);
  }
}
