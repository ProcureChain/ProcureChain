import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { RfqService } from './rfq.service';
import {
  AddRFQSuppliersDto,
  AttachSupplierFormDto,
  AwardRFQDto,
  CloseRFQDto,
  CreateRFQDto,
  CreateSupplierFormTemplateDto,
  ReleaseRFQDto,
} from './rfq.dto';
import { TenantGuard } from '../common/tenant.guard';

@Controller('rfqs')
@UseGuards(TenantGuard)
export class RfqController {
  constructor(private readonly rfqs: RfqService) {}

  @Get()
  list(@Req() req: any) {
    return this.rfqs.list(req.ctx);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateRFQDto) {
    return this.rfqs.create(req.ctx, dto);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.rfqs.get(req.ctx, id);
  }

  @Get('forms/templates')
  listTemplates(@Req() req: any) {
    return this.rfqs.listSupplierFormTemplates(req.ctx);
  }

  @Post('forms/templates')
  createTemplate(@Req() req: any, @Body() dto: CreateSupplierFormTemplateDto) {
    return this.rfqs.createSupplierFormTemplate(req.ctx, dto);
  }

  @Get(':id/forms')
  listRfqForms(@Req() req: any, @Param('id') id: string) {
    return this.rfqs.listRfqSupplierForms(req.ctx, id);
  }

  @Post(':id/forms')
  attachRfqForm(@Req() req: any, @Param('id') id: string, @Body() dto: AttachSupplierFormDto) {
    return this.rfqs.attachSupplierForm(req.ctx, id, dto);
  }

  @Post(':id/suppliers')
  addSuppliers(@Req() req: any, @Param('id') id: string, @Body() dto: AddRFQSuppliersDto) {
    return this.rfqs.addSuppliers(req.ctx, id, dto);
  }

  @Post(':id/release')
  release(@Req() req: any, @Param('id') id: string, @Body() dto: ReleaseRFQDto) {
    return this.rfqs.release(req.ctx, id, dto);
  }

  @Post(':id/open')
  open(@Req() req: any, @Param('id') id: string) {
    return this.rfqs.open(req.ctx, id);
  }

  @Post(':id/award')
  award(@Req() req: any, @Param('id') id: string, @Body() dto: AwardRFQDto) {
    return this.rfqs.award(req.ctx, id, dto);
  }

  @Post(':id/close')
  close(@Req() req: any, @Param('id') id: string, @Body() dto: CloseRFQDto) {
    return this.rfqs.close(req.ctx, id, dto.reason);
  }
}
