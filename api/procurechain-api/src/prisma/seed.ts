import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.tenant.upsert({
    where: { id: 'dev-tenant' },
    update: {},
    create: { id: 'dev-tenant', name: 'Dev Tenant' },
  });

  await prisma.company.upsert({
    where: { id: 'dev-company' },
    update: {},
    create: { id: 'dev-company', tenantId: 'dev-tenant', name: 'Dev Company' },
  });
}

main()
  .then(() => console.log('Seed complete'))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
