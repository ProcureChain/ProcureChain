-- Expand PR lifecycle states
ALTER TYPE "PRStatus" ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';
ALTER TYPE "PRStatus" ADD VALUE IF NOT EXISTS 'CONVERTED_TO_RFQ';
ALTER TYPE "PRStatus" ADD VALUE IF NOT EXISTS 'CLOSED';

-- Expand RFQ lifecycle states and migrate ISSUED -> OPEN
BEGIN;
CREATE TYPE "RFQStatus_new" AS ENUM ('DRAFT', 'RELEASED', 'OPEN', 'AWARDED', 'CLOSED');
ALTER TABLE "RFQ" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "RFQ" ALTER COLUMN "status" TYPE "RFQStatus_new" USING (
  CASE "status"::text
    WHEN 'ISSUED' THEN 'OPEN'
    ELSE "status"::text
  END::"RFQStatus_new"
);
ALTER TYPE "RFQStatus" RENAME TO "RFQStatus_old";
ALTER TYPE "RFQStatus_new" RENAME TO "RFQStatus";
DROP TYPE "RFQStatus_old";
ALTER TABLE "RFQ" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- RFQ timing columns aligned to RELEASED/OPEN stages
ALTER TABLE "RFQ" RENAME COLUMN "issuedAt" TO "openedAt";
ALTER TABLE "RFQ" ADD COLUMN "releasedAt" TIMESTAMP(3);

-- RFQ award entity
CREATE TABLE "RFQAward" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "overrideReason" TEXT NOT NULL,
    "notes" TEXT,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RFQAward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RFQAward_rfqId_key" ON "RFQAward"("rfqId");
CREATE INDEX "RFQAward_tenantId_companyId_awardedAt_idx" ON "RFQAward"("tenantId", "companyId", "awardedAt");
CREATE INDEX "RFQAward_supplierId_idx" ON "RFQAward"("supplierId");

ALTER TABLE "RFQAward" ADD CONSTRAINT "RFQAward_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RFQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RFQAward" ADD CONSTRAINT "RFQAward_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
