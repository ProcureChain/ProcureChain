import { BadRequestException } from '@nestjs/common';
import { ComplianceService } from './compliance.service';

describe('ComplianceService', () => {
  const ctx = { tenantId: 't1', companyId: 'c1', userId: 'u1', roles: ['PROCUREMENT_MANAGER'] };

  const prisma = {
    cOIDeclaration: {
      findMany: jest.fn(),
    },
  } as any;

  const audit = {
    record: jest.fn(),
  } as any;

  const policy = {
    assertActionAllowed: jest.fn(),
  } as any;

  let service: ComplianceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ComplianceService(prisma, audit, policy);
  });

  it('blocks award when unresolved COI exists', async () => {
    prisma.cOIDeclaration.findMany.mockResolvedValue([{ id: 'coi1', status: 'PENDING' }]);

    await expect(service.assertAwardAllowed(ctx, 'rfq1', 's1')).rejects.toThrow(BadRequestException);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'COI_AWARD_BLOCKED' }),
    );
  });

  it('allows award when no COI blockers exist', async () => {
    prisma.cOIDeclaration.findMany.mockResolvedValue([]);

    await expect(service.assertAwardAllowed(ctx, 'rfq1', 's1')).resolves.toBeUndefined();
  });
});
