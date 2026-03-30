import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ProcurementBand, ProcurementMethod, SoDAction } from '@prisma/client';
import type { UpdateProcurementPolicyDto, UpdateSoDRuleDto } from './policy.dto';

type Ctx = { tenantId: string; companyId: string; userId?: string; roles?: string[] };

type ResolveParams = {
  budgetAmount?: number;
  isEmergency?: boolean;
  requestedMethod?: ProcurementMethod;
  emergencyJustification?: string;
};

@Injectable()
export class PolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private readonly defaultSodRules: Record<SoDAction, string[]> = {
    RFQ_RELEASE: ['PROCUREMENT_OFFICER', 'PROCUREMENT_MANAGER'],
    RFQ_OPEN: ['PROCUREMENT_OFFICER', 'PROCUREMENT_MANAGER'],
    RFQ_AWARD: ['PROCUREMENT_MANAGER', 'COMPLIANCE_OFFICER'],
    COI_REVIEW: ['COMPLIANCE_OFFICER'],
    BID_EVALUATE: ['PROCUREMENT_OFFICER', 'PROCUREMENT_MANAGER', 'EVALUATOR'],
    BID_RECOMMEND: ['PROCUREMENT_MANAGER', 'COMPLIANCE_OFFICER'],
  };

  async getProcurementPolicy(ctx: Ctx) {
    return this.prisma.tenantProcurementPolicy.upsert({
      where: {
        tenantId_companyId: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
        },
      },
      update: {},
      create: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
      },
    });
  }

  async updateProcurementPolicy(ctx: Ctx, dto: UpdateProcurementPolicyDto) {
    const current = await this.getProcurementPolicy(ctx);
    const lowThreshold = dto.lowThreshold ?? Number(current.lowThreshold);
    const midThreshold = dto.midThreshold ?? Number(current.midThreshold);

    if (lowThreshold >= midThreshold) {
      throw new BadRequestException('lowThreshold must be less than midThreshold');
    }

    const updated = await this.prisma.tenantProcurementPolicy.update({
      where: {
        tenantId_companyId: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
        },
      },
      data: {
        lowThreshold,
        midThreshold,
        lowMethod: dto.lowMethod,
        midMethod: dto.midMethod,
        highMethod: dto.highMethod,
        emergencyMethod: dto.emergencyMethod,
        emergencyEnabled: dto.emergencyEnabled,
        requireEmergencyJustification: dto.requireEmergencyJustification,
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'PROCUREMENT_POLICY_UPDATED',
      entityType: 'TenantProcurementPolicy',
      entityId: updated.id,
      payload: dto,
    });

    return updated;
  }

  async resolveProcurementMethod(ctx: Ctx, params: ResolveParams) {
    const policy = await this.getProcurementPolicy(ctx);
    const amount = Number(params.budgetAmount ?? 0);
    const isEmergency = params.isEmergency === true;

    if (isEmergency) {
      if (!policy.emergencyEnabled) {
        throw new BadRequestException('Emergency procurement is disabled by tenant policy');
      }
      if (policy.requireEmergencyJustification && !params.emergencyJustification?.trim()) {
        throw new BadRequestException('emergencyJustification is required for emergency procurement');
      }

      if (params.requestedMethod && params.requestedMethod !== policy.emergencyMethod) {
        throw new BadRequestException(
          `Requested procurementMethod (${params.requestedMethod}) violates policy. Required: ${policy.emergencyMethod}`,
        );
      }

      return {
        band: ProcurementBand.EMERGENCY,
        method: policy.emergencyMethod,
        policy,
      };
    }

    let band: ProcurementBand;
    let method: ProcurementMethod;

    if (amount <= Number(policy.lowThreshold)) {
      band = ProcurementBand.LOW;
      method = policy.lowMethod;
    } else if (amount <= Number(policy.midThreshold)) {
      band = ProcurementBand.MID;
      method = policy.midMethod;
    } else {
      band = ProcurementBand.HIGH;
      method = policy.highMethod;
    }

    if (params.requestedMethod && params.requestedMethod !== method) {
      throw new BadRequestException(
        `Requested procurementMethod (${params.requestedMethod}) violates policy. Required: ${method}`,
      );
    }

    return { band, method, policy };
  }

  async listSoDRules(ctx: Ctx) {
    return this.prisma.soDPolicyRule.findMany({
      where: { tenantId: ctx.tenantId, companyId: ctx.companyId },
      orderBy: { action: 'asc' },
    });
  }

  async upsertSoDRule(ctx: Ctx, action: SoDAction, dto: UpdateSoDRuleDto) {
    const allowedRoles = dto.allowedRoles?.map((r) => r.trim().toUpperCase()).filter(Boolean);
    const blockedRoles = dto.blockedRoles?.map((r) => r.trim().toUpperCase()).filter(Boolean);

    const updated = await this.prisma.soDPolicyRule.upsert({
      where: {
        tenantId_companyId_action: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          action,
        },
      },
      create: {
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        action,
        allowedRoles: allowedRoles ?? this.defaultSodRules[action],
        blockedRoles: blockedRoles ?? [],
        isActive: dto.isActive ?? true,
      },
      update: {
        allowedRoles,
        blockedRoles,
        isActive: dto.isActive,
      },
    });

    await this.audit.record({
      tenantId: ctx.tenantId,
      companyId: ctx.companyId,
      actor: ctx.userId ?? 'dev-user',
      eventType: 'SOD_RULE_UPDATED',
      entityType: 'SoDPolicyRule',
      entityId: updated.id,
      payload: { action, ...dto },
    });

    return updated;
  }

  async assertActionAllowed(ctx: Ctx, action: SoDAction) {
    const actorRoles = (ctx.roles ?? ['PROCUREMENT_OFFICER'])
      .map((r) => r.toUpperCase())
      .filter(Boolean);

    if (actorRoles.includes('SUPERADMIN')) {
      return;
    }

    const rule = await this.prisma.soDPolicyRule.findUnique({
      where: {
        tenantId_companyId_action: {
          tenantId: ctx.tenantId,
          companyId: ctx.companyId,
          action,
        },
      },
    });

    const isActive = rule?.isActive ?? true;
    const allowedRoles = (rule?.allowedRoles && rule.allowedRoles.length > 0)
      ? rule.allowedRoles
      : this.defaultSodRules[action];
    const blockedRoles = rule?.blockedRoles ?? [];

    if (!isActive) {
      return;
    }

    const hasBlockedRole = actorRoles.some((r) => blockedRoles.includes(r));
    const hasAllowedRole = actorRoles.some((r) => allowedRoles.includes(r));

    if (hasBlockedRole || !hasAllowedRole) {
      await this.audit.record({
        tenantId: ctx.tenantId,
        companyId: ctx.companyId,
        actor: ctx.userId ?? 'dev-user',
        eventType: 'SOD_VIOLATION_BLOCKED',
        entityType: 'SoDPolicyRule',
        entityId: action,
        payload: {
          action,
          actorRoles,
          allowedRoles,
          blockedRoles,
        },
      });

      throw new ForbiddenException(`Action ${action} is not allowed for current actor roles`);
    }
  }
}
