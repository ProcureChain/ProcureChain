-- CreateEnum
CREATE TYPE "ProcurementMethod" AS ENUM ('LOW_VALUE_QUOTATION', 'LIMITED_TENDER', 'OPEN_TENDER', 'EMERGENCY_DIRECT');

-- CreateEnum
CREATE TYPE "ProcurementBand" AS ENUM ('LOW', 'MID', 'HIGH', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "SoDAction" AS ENUM ('RFQ_RELEASE', 'RFQ_OPEN', 'RFQ_AWARD', 'COI_REVIEW');

-- CreateEnum
CREATE TYPE "COIStatus" AS ENUM ('PENDING', 'APPROVED', 'BLOCKED');

-- AlterTable
ALTER TABLE "RFQ" ADD COLUMN "procurementBand" "ProcurementBand",
ADD COLUMN "procurementMethod" "ProcurementMethod",
ADD COLUMN "isEmergency" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "emergencyJustification" TEXT;

-- CreateTable
CREATE TABLE "TenantProcurementPolicy" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "lowThreshold" DECIMAL(18,2) NOT NULL DEFAULT 10000,
    "midThreshold" DECIMAL(18,2) NOT NULL DEFAULT 100000,
    "lowMethod" "ProcurementMethod" NOT NULL DEFAULT 'LOW_VALUE_QUOTATION',
    "midMethod" "ProcurementMethod" NOT NULL DEFAULT 'LIMITED_TENDER',
    "highMethod" "ProcurementMethod" NOT NULL DEFAULT 'OPEN_TENDER',
    "emergencyMethod" "ProcurementMethod" NOT NULL DEFAULT 'EMERGENCY_DIRECT',
    "emergencyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "requireEmergencyJustification" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,

    CONSTRAINT "TenantProcurementPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoDPolicyRule" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "action" "SoDAction" NOT NULL,
    "allowedRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blockedRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SoDPolicyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "COIDeclaration" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "supplierId" TEXT,
    "declaredBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "COIStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "COIDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantProcurementPolicy_tenantId_companyId_key" ON "TenantProcurementPolicy"("tenantId", "companyId");

-- CreateIndex
CREATE INDEX "TenantProcurementPolicy_tenantId_companyId_idx" ON "TenantProcurementPolicy"("tenantId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "SoDPolicyRule_tenantId_companyId_action_key" ON "SoDPolicyRule"("tenantId", "companyId", "action");

-- CreateIndex
CREATE INDEX "SoDPolicyRule_tenantId_companyId_isActive_idx" ON "SoDPolicyRule"("tenantId", "companyId", "isActive");

-- CreateIndex
CREATE INDEX "COIDeclaration_tenantId_companyId_rfqId_status_idx" ON "COIDeclaration"("tenantId", "companyId", "rfqId", "status");

-- CreateIndex
CREATE INDEX "COIDeclaration_supplierId_idx" ON "COIDeclaration"("supplierId");

-- AddForeignKey
ALTER TABLE "TenantProcurementPolicy" ADD CONSTRAINT "TenantProcurementPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantProcurementPolicy" ADD CONSTRAINT "TenantProcurementPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoDPolicyRule" ADD CONSTRAINT "SoDPolicyRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoDPolicyRule" ADD CONSTRAINT "SoDPolicyRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "COIDeclaration" ADD CONSTRAINT "COIDeclaration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "COIDeclaration" ADD CONSTRAINT "COIDeclaration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "COIDeclaration" ADD CONSTRAINT "COIDeclaration_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RFQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "COIDeclaration" ADD CONSTRAINT "COIDeclaration_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
