import { Module } from '@nestjs/common';
import { BidController } from './bid.controller';
import { BidService } from './bid.service';
import { AuditModule } from '../audit/audit.module';
import { RulesModule } from '../rules/rules.module';
import { PolicyModule } from '../policy/policy.module';

@Module({
  imports: [AuditModule, RulesModule, PolicyModule],
  controllers: [BidController],
  providers: [BidService],
  exports: [BidService],
})
export class BidModule {}
