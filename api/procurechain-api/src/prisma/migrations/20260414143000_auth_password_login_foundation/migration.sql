ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

ALTER TABLE "Supplier"
  ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

INSERT INTO "User" (
  "id",
  "tenantId",
  "companyId",
  "email",
  "passwordHash",
  "roles",
  "createdAt"
)
SELECT
  'dev-org-user',
  'dev-tenant',
  'dev-company',
  'dev-org@procurechain.local',
  'scrypt$18857a1310fee22d4290d4f56bb94dac$13a6bab23c640f38e386db56c9d8cfcf4f8079ba5e470e93ef7691fba0d0e6b7e8316d041d43891fbfc148224037c79c3dd2d4ae480c3c5f67bbeecaab83eb35',
  ARRAY['SUPERADMIN','PROCUREMENT_OFFICER','PROCUREMENT_MANAGER','COMPLIANCE_OFFICER','ADMIN','EVALUATOR']::TEXT[],
  NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM "User"
  WHERE "tenantId" = 'dev-tenant'
    AND "companyId" = 'dev-company'
    AND COALESCE("email", '') = 'dev-org@procurechain.local'
);

UPDATE "User"
SET "passwordHash" = 'scrypt$18857a1310fee22d4290d4f56bb94dac$13a6bab23c640f38e386db56c9d8cfcf4f8079ba5e470e93ef7691fba0d0e6b7e8316d041d43891fbfc148224037c79c3dd2d4ae480c3c5f67bbeecaab83eb35'
WHERE "passwordHash" IS NULL;

UPDATE "Supplier"
SET "passwordHash" = 'scrypt$18857a1310fee22d4290d4f56bb94dac$13a6bab23c640f38e386db56c9d8cfcf4f8079ba5e470e93ef7691fba0d0e6b7e8316d041d43891fbfc148224037c79c3dd2d4ae480c3c5f67bbeecaab83eb35'
WHERE "passwordHash" IS NULL;
