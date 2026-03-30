CREATE TYPE "RFQCommercialApprovalStatus" AS ENUM ('PENDING', 'INFO_REQUESTED', 'APPROVED', 'REJECTED');

ALTER TABLE "PurchaseRequisition"
  DROP COLUMN "totalAmount";

ALTER TABLE "PurchaseRequisitionLine"
  DROP COLUMN "unitPrice",
  DROP COLUMN "lineTotal";

ALTER TABLE "RFQ"
  ADD COLUMN "commercialApprovalStatus" "RFQCommercialApprovalStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "commercialApprovalComment" TEXT,
  ADD COLUMN "commercialApprovedAt" TIMESTAMP(3),
  ADD COLUMN "commercialApprovedBy" TEXT;
