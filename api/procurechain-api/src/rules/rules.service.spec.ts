import { RulesService } from './rules.service';

describe('RulesService', () => {
  const prisma = {
    rulePackFieldRequirement: {
      findMany: jest.fn(),
    },
    subcategoryRuleFormConfig: {
      findUnique: jest.fn(),
    },
  } as any;

  const taxonomy = {
    resolveEffectiveConfig: jest.fn(),
  } as any;

  let service: RulesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RulesService(prisma, taxonomy);
  });

  it('returns missing fields when required paths are absent', async () => {
    taxonomy.resolveEffectiveConfig.mockResolvedValue({
      subcategory: { archetype: 'C' },
      keys: { prRulePackKey: 'rules.pr.fac.srv.maintenance.global.v1' },
    });
    prisma.subcategoryRuleFormConfig.findUnique.mockResolvedValue({ serviceFamily: 'HYBRID' });
    prisma.rulePackFieldRequirement.findMany.mockResolvedValue([
      { fieldPath: 'metadata.serviceBlend', message: 'service blend is mandatory' },
      { fieldPath: 'subcategoryId', message: null },
    ]);

    const out = await service.validatePayload('PR', {
      subcategoryId: 'FAC-SRV-MNT-001',
      payload: { title: 'x' },
    });

    expect(out.valid).toBe(false);
    expect(out.serviceFamily).toBe('HYBRID');
    expect(out.missingFields).toHaveLength(2);
  });

  it('provides hooks for all service families', () => {
    const families = ['MEASURABLE', 'LABOUR', 'PROFESSIONAL', 'MAINTENANCE', 'PROJECT', 'HYBRID'] as const;
    for (const family of families) {
      const checks = service.getEvaluationHooks(family);
      expect(checks.length).toBeGreaterThan(0);

      const invoice = service.getInvoiceHooks(family, 500);
      expect(invoice.family).toBe(family);
      expect(invoice.checks.length).toBeGreaterThan(0);
      expect(invoice.varianceSeverity).toBe('LOW');
    }
  });
});
