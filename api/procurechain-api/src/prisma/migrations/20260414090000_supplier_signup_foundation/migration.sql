CREATE TYPE "SupplierVerificationStatus" AS ENUM (
  'PENDING',
  'UNDER_REVIEW',
  'VERIFIED',
  'REJECTED'
);

CREATE TYPE "SupplierTier" AS ENUM (
  'BRONZE',
  'SILVER',
  'GOLD'
);

CREATE TABLE "SupplierOnboardingProfile" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "yearsInOperation" INTEGER,
  "employeeCountRange" TEXT,
  "regionsServed" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "selectedCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "questionnaire" JSONB,
  "scoreBreakdown" JSONB,
  "tier" "SupplierTier" NOT NULL DEFAULT 'BRONZE',
  "verificationStatus" "SupplierVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "verifiedAt" TIMESTAMP(3),
  "verifiedBy" TEXT,
  CONSTRAINT "SupplierOnboardingProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierDocument" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "fieldKey" TEXT NOT NULL,
  "label" TEXT,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "storagePath" TEXT NOT NULL,
  CONSTRAINT "SupplierDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierOnboardingProfile_supplierId_key" ON "SupplierOnboardingProfile"("supplierId");
CREATE INDEX "SupplierOnboardingProfile_tenantId_companyId_createdAt_idx" ON "SupplierOnboardingProfile"("tenantId", "companyId", "createdAt");
CREATE INDEX "SupplierOnboardingProfile_verificationStatus_tier_createdAt_idx" ON "SupplierOnboardingProfile"("verificationStatus", "tier", "createdAt");
CREATE INDEX "SupplierDocument_tenantId_companyId_supplierId_createdAt_idx" ON "SupplierDocument"("tenantId", "companyId", "supplierId", "createdAt");
CREATE INDEX "SupplierDocument_supplierId_fieldKey_idx" ON "SupplierDocument"("supplierId", "fieldKey");

ALTER TABLE "SupplierOnboardingProfile"
  ADD CONSTRAINT "SupplierOnboardingProfile_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierOnboardingProfile"
  ADD CONSTRAINT "SupplierOnboardingProfile_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierOnboardingProfile"
  ADD CONSTRAINT "SupplierOnboardingProfile_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierDocument"
  ADD CONSTRAINT "SupplierDocument_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierDocument"
  ADD CONSTRAINT "SupplierDocument_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierDocument"
  ADD CONSTRAINT "SupplierDocument_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "OrganizationProfile" (
  "id",
  "createdAt",
  "updatedAt",
  "tenantId",
  "companyId",
  "industry",
  "country",
  "contactFullName",
  "workEmail",
  "monthlyProcurementSpendRange",
  "mainCategoriesPurchased",
  "usesProcurementSystem",
  "verificationStatus",
  "verifiedAt",
  "verifiedBy"
)
SELECT
  md5(random()::text || clock_timestamp()::text),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  'dev-tenant',
  'dev-company',
  'General',
  'ZA',
  'Dev Org Admin',
  'dev-org@procurechain.local',
  'Demo',
  ARRAY[]::TEXT[],
  TRUE,
  'VERIFIED'::"OrganizationVerificationStatus",
  CURRENT_TIMESTAMP,
  'migration'
WHERE EXISTS (
  SELECT 1 FROM "Company" WHERE "id" = 'dev-company' AND "tenantId" = 'dev-tenant'
)
AND NOT EXISTS (
  SELECT 1 FROM "OrganizationProfile" WHERE "companyId" = 'dev-company'
);

UPDATE "OrganizationProfile"
SET
  "verificationStatus" = 'VERIFIED'::"OrganizationVerificationStatus",
  "verifiedAt" = COALESCE("verifiedAt", CURRENT_TIMESTAMP),
  "verifiedBy" = COALESCE("verifiedBy", 'migration')
WHERE "companyId" = 'dev-company' AND "tenantId" = 'dev-tenant';
