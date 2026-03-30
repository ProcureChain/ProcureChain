import { AuditService } from './audit.service';

describe('AuditService', () => {
  const prisma = {
    auditEvent: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  } as any;

  let service: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditService(prisma);
  });

  it('writes chained hash fields on record', async () => {
    prisma.auditEvent.findFirst.mockResolvedValue({ eventHash: 'prev-hash' });
    prisma.auditEvent.create.mockResolvedValue({ id: 'a1' });

    await service.record({
      tenantId: 't1',
      companyId: 'c1',
      actor: 'u1',
      eventType: 'TEST',
      entityType: 'System',
      entityId: 'x',
      payload: { a: 1 },
    });

    expect(prisma.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          prevEventHash: 'prev-hash',
          immutable: true,
          eventHash: expect.any(String),
        }),
      }),
    );
  });
});
