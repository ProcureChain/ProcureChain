-- PR process hardening: returned state, approved-edit tracking, and persisted PR documents.
ALTER TYPE "PRStatus" ADD VALUE IF NOT EXISTS 'RETURNED';

ALTER TABLE "PurchaseRequisition"
  ADD COLUMN IF NOT EXISTS "editedAfterApprovalAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastEditedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastEditSource" TEXT;

CREATE TABLE IF NOT EXISTS "PurchaseRequisitionDocument" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "prId" TEXT NOT NULL,
  "fieldKey" TEXT,
  "label" TEXT,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "storagePath" TEXT NOT NULL,
  CONSTRAINT "PurchaseRequisitionDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PurchaseRequisitionDocument_tenantId_companyId_prId_createdAt_idx"
  ON "PurchaseRequisitionDocument"("tenantId", "companyId", "prId", "createdAt");

CREATE INDEX IF NOT EXISTS "PurchaseRequisitionDocument_prId_fieldKey_idx"
  ON "PurchaseRequisitionDocument"("prId", "fieldKey");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'PurchaseRequisitionDocument_prId_fkey'
      AND table_name = 'PurchaseRequisitionDocument'
  ) THEN
    ALTER TABLE "PurchaseRequisitionDocument"
      ADD CONSTRAINT "PurchaseRequisitionDocument_prId_fkey"
      FOREIGN KEY ("prId") REFERENCES "PurchaseRequisition"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
