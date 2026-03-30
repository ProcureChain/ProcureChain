ALTER TABLE "RFQ"
  ADD COLUMN "budgetAmount" DECIMAL(18,2),
  ADD COLUMN "currency" TEXT DEFAULT 'ZAR',
  ADD COLUMN "paymentTerms" TEXT,
  ADD COLUMN "taxIncluded" BOOLEAN,
  ADD COLUMN "priceValidityDays" INTEGER;
