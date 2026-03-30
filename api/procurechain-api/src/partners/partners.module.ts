import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PartnerAccessService } from './partner-access.service';

@Module({
  imports: [PrismaModule],
  providers: [PartnerAccessService],
  exports: [PartnerAccessService],
})
export class PartnersModule {}
