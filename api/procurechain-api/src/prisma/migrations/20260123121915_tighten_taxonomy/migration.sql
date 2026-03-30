/*
  Warnings:

  - Made the column `level1` on table `Subcategory` required. This step will fail if there are existing NULL values in that column.
  - Made the column `level2` on table `Subcategory` required. This step will fail if there are existing NULL values in that column.
  - Made the column `archetype` on table `Subcategory` required. This step will fail if there are existing NULL values in that column.
  - Made the column `level3` on table `Subcategory` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Subcategory" ALTER COLUMN "level1" SET NOT NULL,
ALTER COLUMN "level2" SET NOT NULL,
ALTER COLUMN "archetype" SET NOT NULL,
ALTER COLUMN "level3" SET NOT NULL;

-- CreateTable
CREATE TABLE "ApprovalRule" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archetype" TEXT,
    "minAmount" DECIMAL(18,2),
    "maxAmount" DECIMAL(18,2),
    "costCentre" TEXT,
    "department" TEXT,
    "chain" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "ApprovalRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApprovalRule_tenantId_companyId_isActive_priority_idx" ON "ApprovalRule"("tenantId", "companyId", "isActive", "priority");

-- CreateIndex
CREATE INDEX "PurchaseRequisition_subcategoryId_idx" ON "PurchaseRequisition"("subcategoryId");
