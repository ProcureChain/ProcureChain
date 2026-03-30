import { PrismaClient, Prisma } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const base = {
    tenantId: 'dev-tenant',
    companyId: 'dev-company',
    isActive: true,
  };

  // helper: Prisma Decimal
  const D = (n: number) => new Prisma.Decimal(n);

  // Seed for both B and F (so you don't break other categories)
  const archetypes: Array<'B' | 'F'> = ['B', 'F'];

  const makeRulesFor = (archetype: 'B' | 'F') => ([
    {
      ...base,
      name: `${archetype} archetype ≤ 5k`,
      archetype,
      minAmount: null,
      maxAmount: D(5000),
      priority: 10,
      chain: [{ role: 'COST_CENTRE_MANAGER', step: 1 }],
    },
    {
      ...base,
      name: `${archetype} archetype 5k–50k`,
      archetype,
      minAmount: D(5000),
      maxAmount: D(50000),
      priority: 20,
      chain: [
        { role: 'COST_CENTRE_MANAGER', step: 1 },
        { role: 'FINANCE_MANAGER', step: 2 },
      ],
    },
    {
      ...base,
      name: `${archetype} archetype > 50k`,
      archetype,
      minAmount: D(50000),
      maxAmount: null,
      priority: 30,
      chain: [
        { role: 'COST_CENTRE_MANAGER', step: 1 },
        { role: 'FINANCE_MANAGER', step: 2 },
        { role: 'CFO', step: 3 },
      ],
    },
  ]);

  // IMPORTANT: choose a stable unique key to upsert on
  // If you don't have a unique constraint, we upsert by (tenantId, companyId, name) manually.
  const allRules = archetypes.flatMap(makeRulesFor);

  for (const r of allRules) {
    const existing = await prisma.approvalRule.findFirst({
      where: {
        tenantId: r.tenantId,
        companyId: r.companyId,
        name: r.name,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.approvalRule.update({
        where: { id: existing.id },
        data: {
          isActive: r.isActive,
          archetype: r.archetype,
          minAmount: r.minAmount as any,
          maxAmount: r.maxAmount as any,
          costCentre: null,
          department: null,
          chain: r.chain as any,
          priority: r.priority,
        },
      });
    } else {
      await prisma.approvalRule.create({ data: r as any });
    }
  }

  console.log(`Seeded/updated ${allRules.length} approval rules (B + F)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => prisma.$disconnect());

