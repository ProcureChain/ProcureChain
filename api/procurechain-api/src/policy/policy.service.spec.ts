import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PolicyService } from './policy.service';

describe('PolicyService', () => {
  const ctx = {
    tenantId: 't1',
    companyId: 'c1',
    userId: 'u1',
    roles: ['PROCUREMENT_OFFICER'],
  };

  const prisma = {
    tenantProcurementPolicy: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    soDPolicyRule: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
  } as any;

  const audit = {
    record: jest.fn(),
  } as any;

  let service: PolicyService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PolicyService(prisma, audit);
  });

  it('resolves LOW band method from tenant policy', async () => {
    prisma.tenantProcurementPolicy.upsert.mockResolvedValue({
      lowThreshold: 10000,
      midThreshold: 100000,
      lowMethod: 'LOW_VALUE_QUOTATION',
      midMethod: 'LIMITED_TENDER',
      highMethod: 'OPEN_TENDER',
      emergencyMethod: 'EMERGENCY_DIRECT',
      emergencyEnabled: true,
      requireEmergencyJustification: true,
    });

    const out = await service.resolveProcurementMethod(ctx, { budgetAmount: 2500 });

    expect(out.band).toBe('LOW');
    expect(out.method).toBe('LOW_VALUE_QUOTATION');
  });

  it('requires emergencyJustification when policy requires it', async () => {
    prisma.tenantProcurementPolicy.upsert.mockResolvedValue({
      lowThreshold: 10000,
      midThreshold: 100000,
      lowMethod: 'LOW_VALUE_QUOTATION',
      midMethod: 'LIMITED_TENDER',
      highMethod: 'OPEN_TENDER',
      emergencyMethod: 'EMERGENCY_DIRECT',
      emergencyEnabled: true,
      requireEmergencyJustification: true,
    });

    await expect(
      service.resolveProcurementMethod(ctx, {
        budgetAmount: 2500,
        isEmergency: true,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('blocks SoD action when roles are not allowed', async () => {
    prisma.soDPolicyRule.findUnique.mockResolvedValue({
      action: 'RFQ_AWARD',
      allowedRoles: ['PROCUREMENT_MANAGER'],
      blockedRoles: [],
      isActive: true,
    });

    await expect(service.assertActionAllowed(ctx, 'RFQ_AWARD')).rejects.toThrow(ForbiddenException);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'SOD_VIOLATION_BLOCKED' }),
    );
  });
});
