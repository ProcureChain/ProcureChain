DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'InvoiceLifecycleStatus'
      AND e.enumlabel = 'ISSUED'
  ) THEN
    ALTER TYPE "InvoiceLifecycleStatus" RENAME VALUE 'ISSUED' TO 'SUBMITTED_TO_ORG';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'UNDER_REVIEW'
      AND enumtypid = to_regtype('"InvoiceLifecycleStatus"')
  ) THEN
    ALTER TYPE "InvoiceLifecycleStatus" ADD VALUE 'UNDER_REVIEW';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'CLOSED'
      AND enumtypid = to_regtype('"InvoiceLifecycleStatus"')
  ) THEN
    ALTER TYPE "InvoiceLifecycleStatus" ADD VALUE 'CLOSED';
  END IF;
END $$;

ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "sourceDocumentPath" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceDocumentName" TEXT,
  ADD COLUMN IF NOT EXISTS "signedDocumentPath" TEXT,
  ADD COLUMN IF NOT EXISTS "signedDocumentName" TEXT,
  ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "submittedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT;
