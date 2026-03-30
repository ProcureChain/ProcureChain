import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RfqService } from './rfq.service';

describe('RfqService lifecycle + award', () => {
  const ctx = { tenantId: 't1', companyId: 'c1' };

  const prisma = {
    rFQ: {
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  } as any;

  const audit = {
    record: jest.fn(),
  } as any;
  const rules = {
    validatePayload: jest.fn(),
  } as any;
  const policy = {
    assertActionAllowed: jest.fn(),
    resolveProcurementMethod: jest.fn(),
  } as any;
  const compliance = {
    assertAwardAllowed: jest.fn(),
  } as any;
  const taxonomy = {
    normalizeAppendixCSubcategoryId: jest.fn((id: string) => id),
  } as any;

  let service: RfqService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RfqService(prisma, audit, rules, policy, compliance, taxonomy);
  });

  it('allows DRAFT -> RELEASED when suppliers are present', async () => {
    jest.spyOn(service as any, 'getScoped').mockResolvedValue({
      id: 'rfq1',
      status: 'DRAFT',
      suppliers: [{ supplierId: 's1' }],
      bids: [],
    });
    prisma.rFQ.update.mockResolvedValue({ id: 'rfq1', status: 'RELEASED' });

    const out = await service.release(ctx, 'rfq1');

    expect(policy.assertActionAllowed).toHaveBeenCalledWith(ctx, 'RFQ_RELEASE');
    expect(prisma.rFQ.update).toHaveBeenCalledWith({
      where: { id: 'rfq1' },
      data: { status: 'RELEASED', releaseMode: 'PRIVATE', releasedAt: expect.any(Date) },
    });
    expect(out.status).toBe('RELEASED');
  });

  it('creates RFQ using budgetAmount instead of PR total', async () => {
    prisma.purchaseRequisition = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'pr1',
        tenantId: 't1',
        companyId: 'c1',
        status: 'APPROVED',
        subcategoryId: 'SER_MEA_CLEANING_M²',
      }),
      update: jest.fn(),
    } as any;
    prisma.rFQ.create = jest.fn().mockResolvedValue({ id: 'rfq1', status: 'DRAFT', pr: {}, suppliers: [] });
    rules.validatePayload.mockResolvedValue({ valid: true });
    policy.resolveProcurementMethod.mockResolvedValue({ band: 'MID', method: 'LIMITED_TENDER' });

    await service.create(ctx, {
      prId: 'pr1',
      title: 'RFQ 1',
      budgetAmount: 12000,
      currency: 'ZAR',
      paymentTerms: 'NET_30',
      taxIncluded: true,
      priceValidityDays: 30,
    } as any);

    expect(policy.resolveProcurementMethod).toHaveBeenCalledWith(ctx, expect.objectContaining({ budgetAmount: 12000 }));
    expect(prisma.rFQ.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          budgetAmount: expect.anything(),
          currency: 'ZAR',
          paymentTerms: 'NET_30',
          taxIncluded: true,
          priceValidityDays: 30,
        }),
      }),
    );
  });

  it('blocks direct RELEASED -> AWARDED', async () => {
    jest.spyOn(service as any, 'getScoped').mockResolvedValue({
      id: 'rfq1',
      status: 'RELEASED',
      suppliers: [{ supplierId: 's1' }],
      bids: [],
    });

    await expect(
      service.award(ctx, 'rfq1', { bidId: 'b1', supplierId: 's1', overrideReason: 'best value' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('requires overrideReason on award', async () => {
    jest.spyOn(service as any, 'getScoped').mockResolvedValue({
      id: 'rfq1',
      status: 'OPEN',
      suppliers: [{ supplierId: 's1' }],
      bids: [{ id: 'b1', supplierId: 's1', status: 'AWARD_RECOMMENDED' }],
    });

    await expect(
      service.award(ctx, 'rfq1', { bidId: 'b1', supplierId: 's1', overrideReason: '' }),
    ).rejects.toThrow('overrideReason is required for award decisions');
  });

  it('executes OPEN -> AWARDED with persisted award', async () => {
    const getScopedSpy = jest.spyOn(service as any, 'getScoped');
    getScopedSpy
      .mockResolvedValueOnce({
        id: 'rfq1',
        status: 'OPEN',
        suppliers: [{ supplierId: 's1' }],
        bids: [{ id: 'b1', supplierId: 's1', status: 'AWARD_RECOMMENDED' }],
      })
      .mockResolvedValueOnce({
        id: 'rfq1',
        status: 'AWARDED',
        suppliers: [{ supplierId: 's1' }],
        bids: [{ id: 'b1', supplierId: 's1', status: 'CLOSED' }],
        award: { bidId: 'b1', supplierId: 's1', overrideReason: 'best lead time' },
      });

    const tx = {
      rFQAward: { upsert: jest.fn() },
      rFQ: { update: jest.fn() },
      bid: { update: jest.fn(), updateMany: jest.fn() },
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const out = await service.award(ctx, 'rfq1', {
      bidId: 'b1',
      supplierId: 's1',
      overrideReason: 'best lead time',
      notes: 'service continuity',
    });

    expect(policy.assertActionAllowed).toHaveBeenCalledWith(ctx, 'RFQ_AWARD');
    expect(compliance.assertAwardAllowed).toHaveBeenCalledWith(ctx, 'rfq1', 's1');
    expect(tx.rFQAward.upsert).toHaveBeenCalled();
    expect(tx.bid.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: expect.objectContaining({ status: 'CLOSED' }),
    });
    expect(tx.rFQ.update).toHaveBeenCalledWith({
      where: { id: 'rfq1' },
      data: { status: 'AWARDED' },
    });
    expect(out.status).toBe('AWARDED');
  });

  it('allows direct award from a SUBMITTED bid', async () => {
    const getScopedSpy = jest.spyOn(service as any, 'getScoped');
    getScopedSpy
      .mockResolvedValueOnce({
        id: 'rfq1',
        tenantId: 't1',
        companyId: 'c1',
        status: 'OPEN',
        prId: 'pr1',
        pr: { id: 'pr1', currency: 'ZAR' },
        suppliers: [{ supplierId: 's1', supplier: { id: 's1' } }],
        bids: [{ id: 'b1', supplierId: 's1', status: 'SUBMITTED' }],
        supplierForms: [],
        award: null,
        currency: 'ZAR',
        paymentTerms: 'NET_30',
      })
      .mockResolvedValueOnce({
        id: 'rfq1',
        status: 'AWARDED',
        suppliers: [{ supplierId: 's1' }],
        bids: [{ id: 'b1', supplierId: 's1', status: 'CLOSED' }],
        award: { bidId: 'b1', supplierId: 's1', overrideReason: 'selected lowest compliant bid' },
      });

    const tx = {
      rFQAward: { upsert: jest.fn().mockResolvedValue({ id: 'award1' }) },
      rFQ: { update: jest.fn().mockResolvedValue({ id: 'rfq1', status: 'AWARDED' }) },
      bid: {
        update: jest.fn().mockResolvedValue({
          id: 'b1',
          rfqId: 'rfq1',
          supplierId: 's1',
          status: 'CLOSED',
          currency: 'ZAR',
          totalBidValue: new Prisma.Decimal(1000),
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      purchaseOrder: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'po1',
          poNumber: 'PO-1',
          status: 'DRAFT',
        }),
      },
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const out = await service.award(ctx, 'rfq1', {
      bidId: 'b1',
      supplierId: 's1',
      overrideReason: 'selected lowest compliant bid',
    });

    expect(tx.bid.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: expect.objectContaining({ status: 'CLOSED', recommended: true }),
    });
    expect(tx.purchaseOrder.create).toHaveBeenCalled();
    expect(out.status).toBe('AWARDED');
  });
});
