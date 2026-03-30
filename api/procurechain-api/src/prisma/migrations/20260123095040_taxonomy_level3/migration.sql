/*
  Warnings:

  - The values [RETURNED] on the enum `PRStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PRStatus_new" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');
ALTER TABLE "PurchaseRequisition" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "PurchaseRequisition" ALTER COLUMN "status" TYPE "PRStatus_new" USING ("status"::text::"PRStatus_new");
ALTER TYPE "PRStatus" RENAME TO "PRStatus_old";
ALTER TYPE "PRStatus_new" RENAME TO "PRStatus";
DROP TYPE "PRStatus_old";
ALTER TABLE "PurchaseRequisition" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterTable
ALTER TABLE "Subcategory" ADD COLUMN     "level3" TEXT;

-- CreateIndex
CREATE INDEX "Subcategory_level1_level2_level3_idx" ON "Subcategory"("level1", "level2", "level3");
