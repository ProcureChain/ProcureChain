import { BadRequestException, Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { SoDAction } from '@prisma/client';
import { TenantGuard } from '../common/tenant.guard';
import { PolicyService } from './policy.service';
import { ResolveProcurementMethodDto, SOD_ACTIONS, UpdateProcurementPolicyDto, UpdateSoDRuleDto } from './policy.dto';

@Controller('policies')
@UseGuards(TenantGuard)
export class PolicyController {
  constructor(private readonly policy: PolicyService) {}

  @Get('procurement')
  getProcurementPolicy(@Req() req: any) {
    return this.policy.getProcurementPolicy(req.ctx);
  }

  @Put('procurement')
  updateProcurementPolicy(@Req() req: any, @Body() dto: UpdateProcurementPolicyDto) {
    return this.policy.updateProcurementPolicy(req.ctx, dto);
  }

  @Post('procurement/resolve')
  resolveProcurementMethod(@Req() req: any, @Body() dto: ResolveProcurementMethodDto) {
    return this.policy.resolveProcurementMethod(req.ctx, dto);
  }

  @Get('sod')
  listSoDRules(@Req() req: any) {
    return this.policy.listSoDRules(req.ctx);
  }

  @Put('sod/:action')
  upsertSoDRule(@Req() req: any, @Param('action') action: string, @Body() dto: UpdateSoDRuleDto) {
    if (!SOD_ACTIONS.includes(action as SoDAction)) {
      throw new BadRequestException(`Invalid SoD action. Expected one of: ${SOD_ACTIONS.join(', ')}`);
    }
    return this.policy.upsertSoDRule(req.ctx, action as SoDAction, dto);
  }
}
