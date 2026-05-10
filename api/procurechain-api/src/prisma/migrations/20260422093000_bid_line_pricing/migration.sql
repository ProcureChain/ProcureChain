CREATE TABLE IF NOT EXISTS "BidLine" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "bidId" TEXT NOT NULL,
  "rfqId" TEXT NOT NULL,
  "prLineId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "uom" TEXT,
  "unitPrice" DECIMAL(18,2) NOT NULL,
  "lineTotal" DECIMAL(18,2) NOT NULL,
  "notes" TEXT,
  CONSTRAINT "BidLine_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PurchaseOrder"
  ADD COLUMN IF NOT EXISTS "lineItems" JSONB;

ALTER TABLE "BidLine"
  ADD CONSTRAINT "BidLine_bidId_fkey"
    FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BidLine"
  ADD CONSTRAINT "BidLine_rfqId_fkey"
    FOREIGN KEY ("rfqId") REFERENCES "RFQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BidLine"
  ADD CONSTRAINT "BidLine_prLineId_fkey"
    FOREIGN KEY ("prLineId") REFERENCES "PurchaseRequisitionLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "BidLine_bidId_prLineId_key"
  ON "BidLine"("bidId", "prLineId");

CREATE INDEX IF NOT EXISTS "BidLine_rfqId_createdAt_idx"
  ON "BidLine"("rfqId", "createdAt");

CREATE INDEX IF NOT EXISTS "BidLine_prLineId_idx"
  ON "BidLine"("prLineId");
