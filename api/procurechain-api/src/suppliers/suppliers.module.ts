import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { AuditModule } from '../audit/audit.module';
import { PartnersModule } from '../partners/partners.module';

@Module({
  imports: [AuditModule, PartnersModule],
  controllers: [SuppliersController],
  providers: [SuppliersService],
})
export class SuppliersModule {}
