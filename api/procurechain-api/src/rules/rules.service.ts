import { Injectable } from '@nestjs/common';
import { ServiceFamily, ValidationEntityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';

function getPathValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function isMissing(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

@Injectable()
export class RulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxonomy: TaxonomyService,
  ) {}

  private async resolveRulePack(subcategoryId: string, country: string | undefined, entity: ValidationEntityType) {
    const resolvedSubcategoryId = this.taxonomy.normalizeAppendixCSubcategoryId(subcategoryId);
    const effective = await this.taxonomy.resolveEffectiveConfig(resolvedSubcategoryId, country);
    switch (entity) {
      case 'PR':
        return { rulePackKey: effective.keys.prRulePackKey, effective };
      case 'RFQ':
        return { rulePackKey: effective.keys.rfqRulePackKey, effective };
      case 'BID':
        return { rulePackKey: effective.keys.bidRulePackKey, effective };
      default:
        return { rulePackKey: effective.keys.prRulePackKey, effective };
    }
  }

  async validatePayload(
    entity: ValidationEntityType,
    params: { subcategoryId: string; country?: string; payload: Record<string, unknown> },
  ) {
    const { rulePackKey, effective } = await this.resolveRulePack(params.subcategoryId, params.country, entity);
    const family = await this.resolveServiceFamily(params.subcategoryId);

    const required = await this.prisma.rulePackFieldRequirement.findMany({
      where: {
        rulePackKey,
        entityType: entity,
        required: true,
      },
      orderBy: { fieldPath: 'asc' },
    });

    const missingFields = required
      .filter((r) => isMissing(getPathValue(params.payload, r.fieldPath)))
      .map((r) => ({
        fieldPath: r.fieldPath,
        message: r.message ?? `${r.fieldPath} is required`,
      }));

    return {
      valid: missingFields.length === 0,
      subcategoryId: params.subcategoryId,
      entityType: entity,
      rulePackKey,
      serviceFamily: family,
      archetype: effective.subcategory.archetype,
      requiredFields: required.map((r) => r.fieldPath),
      missingFields,
    };
  }

  async resolveServiceFamily(subcategoryId: string): Promise<ServiceFamily> {
    const config = await this.prisma.subcategoryRuleFormConfig.findUnique({
      where: { subcategoryId },
      select: { serviceFamily: true },
    });

    return config?.serviceFamily ?? 'PROJECT';
  }

  getEvaluationHooks(family: ServiceFamily) {
    switch (family) {
      case 'MEASURABLE':
        return ['baseline_kpi_defined', 'measurement_method_defined', 'target_threshold_set'];
      case 'LABOUR':
        return ['resource_mix_verified', 'hourly_rates_normalized', 'coverage_plan_complete'];
      case 'PROFESSIONAL':
        return ['cv_and_experience_weighting', 'method_statement_scored', 'deliverable_acceptance_defined'];
      case 'MAINTENANCE':
        return ['sla_response_commitment', 'preventive_schedule_defined', 'downtime_penalty_defined'];
      case 'PROJECT':
        return ['milestone_plan_scored', 'critical_path_validated', 'dependency_risk_reviewed'];
      case 'HYBRID':
        return ['family_mix_validated', 'cross_family_weighting_defined', 'blended_invoice_controls_defined'];
      default:
        return ['generic_commercial_check'];
    }
  }

  getInvoiceHooks(family: ServiceFamily, varianceAbs: number) {
    const base =
      family === 'MEASURABLE'
        ? ['kpi_attainment_vs_invoice', 'unit_rate_vs_output']
        : family === 'LABOUR'
          ? ['timesheet_vs_invoice', 'resource_grade_vs_rate']
          : family === 'PROFESSIONAL'
            ? ['deliverable_acceptance_vs_billing', 'phase_completion_vs_invoice']
            : family === 'MAINTENANCE'
              ? ['sla_breach_credits_applied', 'planned_vs_unplanned_work_split']
              : family === 'PROJECT'
                ? ['milestone_certificate_vs_invoice', 'retention_holdback_applied']
                : ['blended_family_allocation_vs_invoice', 'hybrid_variance_split'];

    return {
      family,
      checks: base,
      varianceSeverity: varianceAbs > 10000 ? 'HIGH' : varianceAbs > 1000 ? 'MEDIUM' : 'LOW',
    };
  }
}
