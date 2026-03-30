import { BadRequestException } from '@nestjs/common';
import { PRService } from './pr.service';

describe('PRService state transitions', () => {
  const ctx = { tenantId: 't1', companyId: 'c1' };

  const prisma = {
    purchaseRequisition: {
      update: jest.fn(),
    },
  } as any;

  const audit = {
    record: jest.fn(),
  } as any;

  const approvals = {
    buildChainFromRules: jest.fn(),
  } as any;
  const rules = {
    validatePayload: jest.fn(),
  } as any;

  let service: PRService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PRService(prisma, audit, approvals, rules);
  });

  it('allows SUBMITTED -> UNDER_REVIEW', async () => {
    jest.spyOn(service, 'get').mockResolvedValue({ id: 'pr1', status: 'SUBMITTED' } as any);
    prisma.purchaseRequisition.update.mockResolvedValue({ id: 'pr1', status: 'UNDER_REVIEW' });

    const out = await service.transitionStatus(ctx, 'pr1', 'UNDER_REVIEW');

    expect(prisma.purchaseRequisition.update).toHaveBeenCalledWith({
      where: { id: 'pr1' },
      data: { status: 'UNDER_REVIEW' },
    });
    expect(out.status).toBe('UNDER_REVIEW');
  });

  it('blocks DRAFT -> APPROVED', async () => {
    jest.spyOn(service, 'get').mockResolvedValue({ id: 'pr1', status: 'DRAFT' } as any);

    await expect(service.transitionStatus(ctx, 'pr1', 'APPROVED')).rejects.toThrow(BadRequestException);
    expect(prisma.purchaseRequisition.update).not.toHaveBeenCalled();
  });

  it('requires reason for REJECTED transition', async () => {
    jest.spyOn(service, 'get').mockResolvedValue({ id: 'pr1', status: 'SUBMITTED' } as any);

    await expect(service.transitionStatus(ctx, 'pr1', 'REJECTED')).rejects.toThrow(
      'reason is required when rejecting a PR',
    );
  });
});
