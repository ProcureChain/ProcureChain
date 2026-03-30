import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { TenantGuard } from '../common/tenant.guard';
import { FamilyHooksDto, ValidatePayloadDto } from './rules.dto';
import { RulesService } from './rules.service';

@Controller('rules')
@UseGuards(TenantGuard)
export class RulesController {
  constructor(private readonly rules: RulesService) {}

  @Post('validate/pr')
  validatePR(@Body() dto: ValidatePayloadDto) {
    return this.rules.validatePayload('PR', dto);
  }

  @Post('validate/rfq')
  validateRFQ(@Body() dto: ValidatePayloadDto) {
    return this.rules.validatePayload('RFQ', dto);
  }

  @Post('validate/bid')
  validateBid(@Body() dto: ValidatePayloadDto) {
    return this.rules.validatePayload('BID', dto);
  }

  @Get('family-hooks')
  async familyHooks(
    @Req() _req: any,
    @Query('subcategoryId') subcategoryId?: string,
    @Query('type') type?: 'invoice' | 'evaluation',
    @Query('varianceAbs') varianceAbs?: string,
  ) {
    if (!subcategoryId?.trim()) {
      throw new BadRequestException('subcategoryId is required');
    }
    const dto: FamilyHooksDto = {
      subcategoryId: subcategoryId.trim(),
      type,
    };

    const family = await this.rules.resolveServiceFamily(dto.subcategoryId);
    if (dto.type === 'invoice') {
      return this.rules.getInvoiceHooks(family, varianceAbs ? Number(varianceAbs) : 0);
    }
    return {
      family,
      checks: this.rules.getEvaluationHooks(family),
    };
  }
}
