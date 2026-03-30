import { GovernanceService } from './governance.service';

describe('GovernanceService', () => {
  const ctx = { tenantId: 't1', companyId: 'c1', userId: 'u1' };

  const prisma = {
    governmentExport: { create: jest.fn() },
    rFQ: { findMany: jest.fn() },
    rFQSupplier: { findMany: jest.fn() },
    rFQAward: { findMany: jest.fn() },
    cOIDeclaration: { findMany: jest.fn() },
    retentionRunLog: { findMany: jest.fn(), create: jest.fn() },
    retentionPolicy: { upsert: jest.fn(), update: jest.fn() },
    auditEvent: { findMany: jest.fn(), count: jest.fn(), deleteMany: jest.fn() },
  } as any;

  const audit = {
    record: jest.fn(),
  } as any;

  let service: GovernanceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GovernanceService(prisma, audit);
  });

  it('generates deterministic hash for same CSV payload', async () => {
    prisma.rFQ.findMany.mockResolvedValue([
      {
        id: 'r1',
        prId: 'p1',
        status: 'OPEN',
        procurementMethod: 'LIMITED_TENDER',
        procurementBand: 'MID',
        isEmergency: false,
        releasedAt: null,
        openedAt: null,
        closedAt: null,
        award: null,
      },
    ]);
    prisma.governmentExport.create.mockResolvedValue({ id: 'e1' });

    const a = await service.generateExport(ctx, 'TENDER_REGISTER', 'CSV');
    const b = await service.generateExport(ctx, 'TENDER_REGISTER', 'CSV');

    expect(a.hashReference).toEqual(b.hashReference);
    expect(prisma.governmentExport.create).toHaveBeenCalledTimes(2);
  });

  it('verifies audit evidence chain', async () => {
    const events = [
      {
        id: 'a1',
        ts: new Date('2026-01-01T00:00:00.000Z'),
        tenantId: 't1',
        companyId: 'c1',
        actor: 'u1',
        eventType: 'A',
        entityType: null,
        entityId: null,
        payload: null,
        prevEventHash: null,
        eventHash: 'wrong',
      },
    ];
    prisma.auditEvent.findMany.mockResolvedValue(events);

    const out = await service.verifyAuditEvidence(ctx, 10);

    expect(out.valid).toBe(false);
    expect(out.brokenEventId).toBe('a1');
  });
});
