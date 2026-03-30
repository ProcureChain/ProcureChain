-- CreateEnum
CREATE TYPE "PRStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'RETURNED', 'REJECTED');

-- CreateTable
CREATE TABLE "Subcategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level1" TEXT,
    "level2" TEXT,
    "archetype" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subcategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequisition" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requesterId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "costCentre" TEXT,
    "department" TEXT,
    "subcategoryId" TEXT,
    "status" "PRStatus" NOT NULL DEFAULT 'DRAFT',
    "approvalChain" JSONB,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "PurchaseRequisition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subcategory_archetype_idx" ON "Subcategory"("archetype");

-- CreateIndex
CREATE INDEX "PurchaseRequisition_tenantId_companyId_createdAt_idx" ON "PurchaseRequisition"("tenantId", "companyId", "createdAt");

-- CreateIndex
CREATE INDEX "PurchaseRequisition_status_createdAt_idx" ON "PurchaseRequisition"("status", "createdAt");
