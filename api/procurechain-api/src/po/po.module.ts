import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { POController } from './po.controller';
import { POService } from './po.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [POController],
  providers: [POService],
  exports: [POService],
})
export class POModule {}
