CREATE TYPE "OrganizationVerificationStatus" AS ENUM (
  'PENDING',
  'UNDER_REVIEW',
  'VERIFIED',
  'REJECTED'
);

CREATE TABLE "OrganizationProfile" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "registrationNumber" TEXT,
  "industry" TEXT,
  "country" TEXT DEFAULT 'ZA',
  "companySize" TEXT,
  "contactFullName" TEXT,
  "workEmail" TEXT,
  "phoneNumber" TEXT,
  "role" TEXT,
  "monthlyProcurementSpendRange" TEXT,
  "mainCategoriesPurchased" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "supplierCountRange" TEXT,
  "usesProcurementSystem" BOOLEAN,
  "verificationStatus" "OrganizationVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "verifiedAt" TIMESTAMP(3),
  "verifiedBy" TEXT,
  CONSTRAINT "OrganizationProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationDocument" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "fieldKey" TEXT NOT NULL,
  "label" TEXT,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "storagePath" TEXT NOT NULL,
  CONSTRAINT "OrganizationDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationProfile_companyId_key" ON "OrganizationProfile"("companyId");
CREATE INDEX "OrganizationProfile_tenantId_companyId_idx" ON "OrganizationProfile"("tenantId", "companyId");
CREATE INDEX "OrganizationProfile_verificationStatus_createdAt_idx" ON "OrganizationProfile"("verificationStatus", "createdAt");
CREATE INDEX "OrganizationDocument_tenantId_companyId_createdAt_idx" ON "OrganizationDocument"("tenantId", "companyId", "createdAt");
CREATE INDEX "OrganizationDocument_companyId_fieldKey_idx" ON "OrganizationDocument"("companyId", "fieldKey");

ALTER TABLE "OrganizationProfile"
  ADD CONSTRAINT "OrganizationProfile_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationProfile"
  ADD CONSTRAINT "OrganizationProfile_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationDocument"
  ADD CONSTRAINT "OrganizationDocument_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationDocument"
  ADD CONSTRAINT "OrganizationDocument_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
