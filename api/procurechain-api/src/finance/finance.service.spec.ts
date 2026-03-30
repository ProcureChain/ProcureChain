import { FinanceService } from './finance.service';
import { Prisma } from '@prisma/client';

describe('FinanceService validation', () => {
  const ctx = { tenantId: 't1', companyId: 'c1' };

  const prisma = {
    purchaseOrder: { findFirst: jest.fn() },
    invoiceSnapshot: { findMany: jest.fn() },
  } as any;

  const audit = { record: jest.fn() } as any;
  const rules = {
    resolveServiceFamily: jest.fn().mockResolvedValue('PROJECT'),
    getInvoiceHooks: jest.fn().mockReturnValue({
      family: 'PROJECT',
      checks: ['milestone_certificate_vs_invoice'],
      varianceSeverity: 'LOW',
    }),
  } as any;

  let service: FinanceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FinanceService(prisma, audit, rules);
  });

  it('returns MATCH for exact invoiced amount', async () => {
    prisma.purchaseOrder.findFirst.mockResolvedValue({
      id: 'po1',
      poNumber: 'PO-1',
      status: 'ACCEPTED',
      currency: 'ZAR',
      committedAmount: new Prisma.Decimal(3000),
    });

    prisma.invoiceSnapshot.findMany.mockResolvedValue([
      { totalAmount: new Prisma.Decimal(3000) },
    ]);

    const out = await service.validatePOInvoices(ctx, 'po1');
    expect(out.matchStatus).toBe('MATCH');
    expect(out.serviceFamily).toBe('PROJECT');
  });
});
