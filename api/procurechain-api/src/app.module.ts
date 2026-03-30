import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { AuditModule } from './audit/audit.module';
import { TaxonomyModule } from './taxonomy/taxonomy.module';
import { PRModule } from './pr/pr.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { RfqModule } from './rfq/rfq.module';
import { POModule } from './po/po.module';
import { FinanceModule } from './finance/finance.module';
import { RulesModule } from './rules/rules.module';
import { PolicyModule } from './policy/policy.module';
import { ComplianceModule } from './compliance/compliance.module';
import { GovernanceModule } from './governance/governance.module';
import { BidModule } from './bid/bid.module';
import { MetricsModule } from './common/metrics.module';


@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuditModule,
    TaxonomyModule,
    PRModule,
    SuppliersModule,
    RfqModule,
    POModule,
    FinanceModule,
    RulesModule,
    PolicyModule,
    ComplianceModule,
    GovernanceModule,
    BidModule,
    MetricsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
