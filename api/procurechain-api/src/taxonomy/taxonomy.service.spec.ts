import { NotFoundException } from '@nestjs/common';
import { TaxonomyService } from './taxonomy.service';

describe('TaxonomyService', () => {
  const prisma = {
    subcategory: {
      findUnique: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    subcategoryRuleFormConfig: { count: jest.fn() },
    rulePackFieldRequirement: { count: jest.fn(), findMany: jest.fn() },
    subcategoryRuleFormOverlay: { count: jest.fn() },
  } as any;

  let service: TaxonomyService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TaxonomyService(prisma);
  });

  it('resolves country overlay keys when present', async () => {
    prisma.subcategory.findUnique.mockResolvedValue({
      id: 'PRO-SRV-CON-001',
      name: 'Management Consulting',
      archetype: 'D',
      level1: 'Professional Services',
      level2: 'Consulting',
      level3: 'Strategy & Advisory',
      ruleFormConfig: {
        prFormKey: 'base-pr',
        rfqFormKey: 'base-rfq',
        bidFormKey: 'base-bid',
        prRulePackKey: 'base-pr-rules',
        rfqRulePackKey: 'base-rfq-rules',
        bidRulePackKey: 'base-bid-rules',
        metadata: null,
      },
      ruleFormOverlays: [
        {
          countryCode: 'ZA',
          rfqRulePackKey: 'za-rfq-rules',
          bidRulePackKey: 'za-bid-rules',
          prFormKey: null,
          rfqFormKey: null,
          bidFormKey: null,
          prRulePackKey: null,
          metadata: null,
        },
      ],
    });

    const out = await service.resolveEffectiveConfig('PRO-SRV-CON-001', 'za');

    expect(out.resolvedFrom).toBe('country_overlay');
    expect(out.keys.rfqRulePackKey).toBe('za-rfq-rules');
    expect(out.keys.prRulePackKey).toBe('base-pr-rules');
  });

  it('throws when subcategory has no config', async () => {
    prisma.subcategory.findUnique.mockResolvedValue({
      id: 'x',
      name: 'x',
      archetype: 'C',
      level1: 'l1',
      level2: 'l2',
      level3: 'l3',
      ruleFormConfig: null,
      ruleFormOverlays: [],
    });

    await expect(service.resolveEffectiveConfig('x', 'ZA')).rejects.toThrow(NotFoundException);
  });

  it('reports taxonomy integrity counts', async () => {
    prisma.subcategory.count.mockResolvedValue(7);
    prisma.subcategoryRuleFormConfig.count.mockResolvedValue(6);
    prisma.rulePackFieldRequirement.count.mockResolvedValue(24);
    prisma.rulePackFieldRequirement.findMany.mockResolvedValue([
      { rulePackKey: 'k1', entityType: 'PR', fieldPath: 'metadata.a', required: true },
    ]);
    prisma.subcategoryRuleFormOverlay.count.mockResolvedValue(1);
    prisma.subcategory.findMany.mockResolvedValue([{ id: 'MISSING-1', name: 'Missing One' }]);
    prisma.subcategoryRuleFormConfig.findMany = jest.fn().mockResolvedValue([
      { subcategoryId: 'a', serviceFamily: 'MEASURABLE' },
      { subcategoryId: 'b', serviceFamily: 'LABOUR' },
      { subcategoryId: 'c', serviceFamily: 'PROFESSIONAL' },
      { subcategoryId: 'd', serviceFamily: 'MAINTENANCE' },
      { subcategoryId: 'e', serviceFamily: 'PROJECT' },
      { subcategoryId: 'f', serviceFamily: 'HYBRID' },
    ]);

    const out = await service.integrity();
    expect(out.taxonomy.subcategoryCount).toBe(7);
    expect(out.taxonomy.missingConfigCount).toBe(1);
    expect(out.taxonomy.requiredFieldCount).toBe(24);
    expect(out.taxonomy.completeFamilyCoverage).toBe(true);
    expect(out.taxonomy.complete).toBe(false);
  });
});
