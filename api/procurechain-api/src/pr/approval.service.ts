import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApprovalService {
  constructor(private readonly prisma: PrismaService) {}

  private matches(
    rule: any,
    input: {
      archetype: string;
      costCentre?: string | null;
      department?: string | null;
    },
  ) {
    if (rule.archetype && rule.archetype !== input.archetype) return false;

    if (rule.costCentre && rule.costCentre !== (input.costCentre ?? null)) return false;
    if (rule.department && rule.department !== (input.department ?? null)) return false;

    return true;
  }

  async buildChainFromRules(params: {
    tenantId: string;
    companyId: string;
    archetype: string;
    costCentre?: string | null;
    department?: string | null;
  }) {
    const rules = await this.prisma.approvalRule.findMany({
      where: {
        tenantId: params.tenantId,
        companyId: params.companyId,
        isActive: true,
      },
      orderBy: { priority: 'asc' },
    });

    const match = rules.find((r) =>
      this.matches(r, {
        archetype: params.archetype,
        costCentre: params.costCentre,
        department: params.department,
      }),
    );

    // fallback: if no rule exists yet, return a safe default
    return match?.chain ?? [{ role: 'COST_CENTRE_MANAGER', step: 1 }];
  }
}
