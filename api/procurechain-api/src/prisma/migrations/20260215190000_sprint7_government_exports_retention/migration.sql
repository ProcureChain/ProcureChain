-- CreateEnum
CREATE TYPE "ExportType" AS ENUM ('TENDER_REGISTER', 'BID_OPENING_RECORD', 'EVALUATION_PACK', 'AWARD_REPORT_NOTICE', 'COI_REGISTER', 'RETENTION_LOG');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'PDF');

-- AlterTable
ALTER TABLE "AuditEvent"
  ADD COLUMN "prevEventHash" TEXT,
  ADD COLUMN "eventHash" TEXT,
  ADD COLUMN "immutable" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "GovernmentExport" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "exportType" "ExportType" NOT NULL,
  "format" "ExportFormat" NOT NULL,
  "contentHash" TEXT NOT NULL,
  "rowCount" INTEGER NOT NULL DEFAULT 0,
  "payload" JSONB,
  CONSTRAINT "GovernmentExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionPolicy" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "auditRetentionDays" INTEGER NOT NULL DEFAULT 2555,
  "enforceImmutability" BOOLEAN NOT NULL DEFAULT true,
  "allowPurge" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionRunLog" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "cutoffTs" TIMESTAMP(3) NOT NULL,
  "eligibleCount" INTEGER NOT NULL DEFAULT 0,
  "purgedCount" INTEGER NOT NULL DEFAULT 0,
  "mode" TEXT NOT NULL DEFAULT 'CHECK_ONLY',
  "summary" JSONB,
  CONSTRAINT "RetentionRunLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GovernmentExport_tenantId_companyId_createdAt_idx" ON "GovernmentExport"("tenantId", "companyId", "createdAt");
CREATE INDEX "GovernmentExport_exportType_createdAt_idx" ON "GovernmentExport"("exportType", "createdAt");
CREATE UNIQUE INDEX "RetentionPolicy_tenantId_companyId_key" ON "RetentionPolicy"("tenantId", "companyId");
CREATE INDEX "RetentionPolicy_tenantId_companyId_idx" ON "RetentionPolicy"("tenantId", "companyId");
CREATE INDEX "RetentionRunLog_tenantId_companyId_createdAt_idx" ON "RetentionRunLog"("tenantId", "companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "GovernmentExport" ADD CONSTRAINT "GovernmentExport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GovernmentExport" ADD CONSTRAINT "GovernmentExport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetentionRunLog" ADD CONSTRAINT "RetentionRunLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetentionRunLog" ADD CONSTRAINT "RetentionRunLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
