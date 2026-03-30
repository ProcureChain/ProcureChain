import { BadRequestException } from '@nestjs/common';
import { BidService } from './bid.service';

describe('BidService', () => {
  const ctx = { tenantId: 't1', companyId: 'c1', userId: 'u1' };

  const prisma = {
    rFQ: { findFirst: jest.fn() },
    rFQSupplier: { findFirst: jest.fn() },
    bid: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    bidScore: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
  } as any;

  const audit = { record: jest.fn() } as any;
  const rules = { validatePayload: jest.fn() } as any;
  const policy = { assertActionAllowed: jest.fn() } as any;

  let service: BidService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BidService(prisma, audit, rules, policy);
  });

  it('creates bid draft when supplier is linked to RFQ', async () => {
    prisma.rFQ.findFirst.mockResolvedValue({
      id: 'rfq1',
      status: 'RELEASED',
      pr: { currency: 'ZAR' },
    });
    prisma.rFQSupplier.findFirst.mockResolvedValue({ id: 'link1' });
    prisma.bid.findFirst.mockResolvedValue(null);
    prisma.bid.upsert.mockResolvedValue({ id: 'b1', version: 1 });

    const out = await service.upsertDraft(ctx, {
      rfqId: 'rfq1',
      supplierId: 's1',
      payload: { compliance: { supplier_documents: true } },
    });

    expect(out.id).toBe('b1');
    expect(prisma.bid.upsert).toHaveBeenCalled();
  });

  it('blocks recommendation before evaluation', async () => {
    jest.spyOn(service as any, 'getScoped').mockResolvedValue({
      id: 'b1',
      status: 'SUBMITTED',
    });

    await expect(service.recommend(ctx, 'b1', { reason: 'best score' })).rejects.toThrow(BadRequestException);
  });

  it('persists evaluation scores and final score', async () => {
    jest.spyOn(service as any, 'getScoped').mockResolvedValue({
      id: 'b1',
      status: 'OPENED',
      rfq: { pr: { subcategoryId: 'FAC-SRV-MNT-001' } },
    });
    prisma.bidScore.findMany.mockResolvedValue([
      { evaluatorId: 'u1', criterion: 'PRICE', score: 80, weight: 50 },
      { evaluatorId: 'u1', criterion: 'DELIVERY', score: 70, weight: 50 },
    ]);
    prisma.bid.update.mockResolvedValue({ id: 'b1', finalScore: '75.00', scores: [] });

    const out = await service.evaluate(ctx, 'b1', {
      criteria: [
        { criterion: 'PRICE', score: 80, weight: 50 },
        { criterion: 'DELIVERY', score: 70, weight: 50 },
      ],
    });

    expect(policy.assertActionAllowed).toHaveBeenCalledWith(ctx, 'BID_EVALUATE');
    expect(prisma.bidScore.upsert).toHaveBeenCalledTimes(2);
    expect(out.id).toBe('b1');
  });
});
