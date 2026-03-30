import { Module } from '@nestjs/common';
import { PRController } from './pr.controller';
import { PRService } from './pr.service';
import { ApprovalService } from './approval.service';
import { AuditModule } from '../audit/audit.module';
import { PRLinesController } from './pr.lines.controller';
import { RulesModule } from '../rules/rules.module';


@Module({
  imports: [AuditModule, RulesModule],
  controllers: [PRController, PRLinesController],
  providers: [PRService, ApprovalService],
})
export class PRModule {}
