import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards, Delete } from '@nestjs/common';
import { TenantGuard } from '../common/tenant.guard';
import { SuppliersService } from './suppliers.service';
import { AddSupplierContactDto, CreateSupplierDto, SetSupplierTagsDto, UpdateSupplierDto } from './supplier.dto';


@Controller('suppliers')
@UseGuards(TenantGuard)
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateSupplierDto) {
    return this.suppliers.create(req.ctx, dto);
  }

  @Get()
    list(
      @Req() req: any,
      @Query('limit') limit?: string,
      @Query('q') q?: string,
      @Query('subcategoryId') subcategoryId?: string,
    ) {
      return this.suppliers.list(
        req.ctx,
        limit ? Number(limit) : 50,
        q,
        subcategoryId,
      );
  }


  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.suppliers.get(req.ctx, id);
  }

  @Post(':id/contacts')
  addContact(@Req() req: any, @Param('id') id: string, @Body() dto: AddSupplierContactDto) {
    return this.suppliers.addContact(req.ctx, id, dto);
  }

  @Post(':id/tags')
  setTags(@Req() req: any, @Param('id') id: string, @Body() dto: SetSupplierTagsDto) {
    return this.suppliers.setTags(req.ctx, id, dto);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliers.update(req.ctx, id, dto);
  }

  @Delete(':id/contacts/:contactId')
    removeContact(
      @Req() req: any,
      @Param('id') id: string,
      @Param('contactId') contactId: string,
    ) {
      return this.suppliers.removeContact(req.ctx, id, contactId);
    }

}
