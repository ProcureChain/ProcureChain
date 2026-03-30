import { BadRequestException } from '@nestjs/common';
import { POService } from './po.service';

describe('POService', () => {
  const ctx = { tenantId: 't1', companyId: 'c1' };

  const prisma = {
    rFQAward: { findFirst: jest.fn() },
    purchaseOrder: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
    pOChangeRequest: { create: jest.fn() },
  } as any;

  const audit = { record: jest.fn() } as any;

  let service: POService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new POService(prisma, audit);
  });

  it('creates PO from award in awarded RFQ', async () => {
    prisma.rFQAward.findFirst.mockResolvedValue({
      id: 'a1',
      rfqId: 'rfq123456',
      bid: { totalBidValue: '3000', currency: 'ZAR' },
      rfq: { status: 'AWARDED', prId: 'pr1', currency: 'ZAR', pr: { currency: 'ZAR' } },
    });
    prisma.purchaseOrder.findUnique.mockResolvedValue(null);
    prisma.purchaseOrder.create.mockResolvedValue({ id: 'po1' });
    jest.spyOn(service as any, 'getScoped').mockResolvedValue({ id: 'po1', status: 'DRAFT' });

    const out = await service.createFromAward(ctx, { awardId: 'a1' });

    expect(prisma.purchaseOrder.create).toHaveBeenCalled();
    expect(out.id).toBe('po1');
  });

  it('blocks PO create when RFQ not awarded/closed', async () => {
    prisma.rFQAward.findFirst.mockResolvedValue({
      id: 'a1',
      bid: { totalBidValue: '3000', currency: 'ZAR' },
      rfq: { status: 'OPEN', prId: 'pr1', currency: 'ZAR', pr: { currency: 'ZAR' } },
    });

    await expect(service.createFromAward(ctx, { awardId: 'a1' })).rejects.toThrow(BadRequestException);
  });

  it('blocks PO create when awarded bid has no value', async () => {
    prisma.rFQAward.findFirst.mockResolvedValue({
      id: 'a1',
      bid: { totalBidValue: null, currency: 'ZAR' },
      rfq: { status: 'AWARDED', prId: 'pr1', currency: 'ZAR', pr: { currency: 'ZAR' } },
    });

    await expect(service.createFromAward(ctx, { awardId: 'a1' })).rejects.toThrow(
      'Awarded bid must contain a totalBidValue before PO creation',
    );
  });

  it('requires reason for supplier change request', async () => {
    jest.spyOn(service as any, 'getScoped').mockResolvedValue({ id: 'po1', status: 'RELEASED' });

    await expect(service.supplierRespond(ctx, 'po1', { action: 'REQUEST_CHANGE' })).rejects.toThrow(
      'reason is required for REQUEST_CHANGE',
    );
  });
});
