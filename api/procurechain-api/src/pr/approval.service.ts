import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApprovalService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeArray(input: unknown) {
    return Array.isArray(input)
      ? input.flatMap((item) => (Array.isArray(item) ? item : [item])).filter((item) => item && typeof item === 'object')
      : [];
  }

  async getOrganizationAdminSettings(tenantId: string, companyId: string) {
    return this.prisma.organizationAdminSettings.findUnique({
      where: { companyId },
    }).then((settings) => {
      if (!settings || settings.tenantId !== tenantId) {
        return {
          departments: [],
          costCentres: [],
          departmentBudgets: [],
          costCentreBudgets: [],
          approvalRoutes: [],
          totalBudget: null,
          budgetCurrency: 'ZAR',
        };
      }
      return {
        departments: this.normalizeArray(settings.departments),
        costCentres: this.normalizeArray(settings.costCentres),
        departmentBudgets: this.normalizeArray(settings.departmentBudgets),
        costCentreBudgets: this.normalizeArray(settings.costCentreBudgets),
        approvalRoutes: this.normalizeArray(settings.approvalRoutes),
        totalBudget: settings.totalBudget == null ? null : Number(settings.totalBudget),
        budgetCurrency: settings.budgetCurrency || 'ZAR',
      };
    });
  }

  async validateOrgStructure(params: {
    tenantId: string;
    companyId: string;
    department?: string | null;
    costCentre?: string | null;
  }) {
    const settings = await this.getOrganizationAdminSettings(params.tenantId, params.companyId);
    const departments = settings.departments as Array<{ name?: string; isActive?: boolean }>;
    const costCentres = settings.costCentres as Array<{ code?: string; isActive?: boolean; departmentId?: string | null }>;

    if (departments.length > 0) {
      if (!params.department?.trim()) {
        throw new BadRequestException('department is required');
      }
      const department = departments.find((entry) => entry.name === params.department);
      if (!department || department.isActive === false) {
        throw new BadRequestException('department must match an active organisation department');
      }
    }

    if (costCentres.length > 0) {
      if (!params.costCentre?.trim()) {
        throw new BadRequestException('costCentre is required');
      }
      const costCentre = costCentres.find((entry) => entry.code === params.costCentre);
      if (!costCentre || costCentre.isActive === false) {
        throw new BadRequestException('costCentre must match an active organisation cost centre');
      }
    }

    return settings;
  }

  async validateBudget(params: {
    tenantId: string;
    companyId: string;
    department?: string | null;
    costCentre?: string | null;
    budgetAmount: number;
  }) {
    const settings = await this.validateOrgStructure(params);
    const departmentList = settings.departments as Array<{ id?: string; name?: string }>;
    const costCentreList = settings.costCentres as Array<{ id?: string; code?: string }>;
    const departmentBudgets = settings.departmentBudgets as Array<{ scopeId?: string; amount?: number }>;
    const costCentreBudgets = settings.costCentreBudgets as Array<{ scopeId?: string; amount?: number }>;

    if (settings.totalBudget != null && params.budgetAmount > Number(settings.totalBudget)) {
      throw new BadRequestException('RFQ budget exceeds configured total organisation budget');
    }

    if (params.department) {
      const department = departmentList.find((entry) => entry.name === params.department);
      const allocation = department && departmentBudgets.find((entry) => entry.scopeId === department.id);
      if (allocation && Number(allocation.amount ?? 0) > 0 && params.budgetAmount > Number(allocation.amount ?? 0)) {
        throw new BadRequestException('RFQ budget exceeds configured department budget');
      }
    }

    if (params.costCentre) {
      const costCentre = costCentreList.find((entry) => entry.code === params.costCentre);
      const allocation = costCentre && costCentreBudgets.find((entry) => entry.scopeId === costCentre.id);
      if (allocation && Number(allocation.amount ?? 0) > 0 && params.budgetAmount > Number(allocation.amount ?? 0)) {
        throw new BadRequestException('RFQ budget exceeds configured cost centre budget');
      }
    }

    return settings;
  }

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
    const settings = await this.getOrganizationAdminSettings(params.tenantId, params.companyId);
    const approvalRoutes = settings.approvalRoutes as Array<{
      scopeType?: 'DEPARTMENT' | 'COST_CENTRE';
      scopeValue?: string;
      roles?: string[];
    }>;

    const costCentreRoute = approvalRoutes.find(
      (route) => route.scopeType === 'COST_CENTRE' && route.scopeValue === (params.costCentre ?? undefined),
    );
    if (costCentreRoute?.roles?.length) {
      return costCentreRoute.roles.map((role, index) => ({ role, step: index + 1 }));
    }

    const departmentRoute = approvalRoutes.find(
      (route) => route.scopeType === 'DEPARTMENT' && route.scopeValue === (params.department ?? undefined),
    );
    if (departmentRoute?.roles?.length) {
      return departmentRoute.roles.map((role, index) => ({ role, step: index + 1 }));
    }

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
