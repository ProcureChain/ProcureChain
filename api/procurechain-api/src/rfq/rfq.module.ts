import { Module } from '@nestjs/common';
import { RfqController } from './rfq.controller';
import { RfqService } from './rfq.service';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RulesModule } from '../rules/rules.module';
import { PolicyModule } from '../policy/policy.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { ApprovalService } from '../pr/approval.service';

@Module({
  imports: [PrismaModule, AuditModule, RulesModule, PolicyModule, ComplianceModule, TaxonomyModule],
  controllers: [RfqController],
  providers: [RfqService, ApprovalService],
})
export class RfqModule {}
