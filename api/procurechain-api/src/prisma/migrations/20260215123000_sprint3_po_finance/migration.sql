-- CreateEnum
CREATE TYPE "POStatus" AS ENUM ('DRAFT', 'RELEASED', 'ACCEPTED', 'CHANGE_REQUESTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "InvoiceSourceSystem" AS ENUM ('ERP', 'QUICKBOOKS', 'MANUAL');

-- CreateEnum
CREATE TYPE "InvoiceMatchStatus" AS ENUM ('MISSING_INVOICE', 'MATCH', 'UNDER_INVOICED', 'OVER_INVOICED');

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "status" "POStatus" NOT NULL DEFAULT 'DRAFT',
    "commercialOnly" BOOLEAN NOT NULL DEFAULT true,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "committedAmount" DECIMAL(18,2) NOT NULL,
    "terms" TEXT,
    "notes" TEXT,
    "awardId" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "prId" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "POChangeRequest" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "poId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "proposedTerms" TEXT,
    "requestedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "POChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceSnapshot" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "externalInvoiceId" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "sourceSystem" "InvoiceSourceSystem" NOT NULL DEFAULT 'MANUAL',
    "poId" TEXT,
    "poNumber" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "invoiceDate" TIMESTAMP(3),
    "status" TEXT,
    "rawPayload" JSONB,

    CONSTRAINT "InvoiceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_awardId_key" ON "PurchaseOrder"("awardId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_tenantId_companyId_poNumber_key" ON "PurchaseOrder"("tenantId", "companyId", "poNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrder_tenantId_companyId_createdAt_idx" ON "PurchaseOrder"("tenantId", "companyId", "createdAt");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_createdAt_idx" ON "PurchaseOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "POChangeRequest_poId_createdAt_idx" ON "POChangeRequest"("poId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceSnapshot_tenantId_companyId_externalInvoiceId_key" ON "InvoiceSnapshot"("tenantId", "companyId", "externalInvoiceId");

-- CreateIndex
CREATE INDEX "InvoiceSnapshot_tenantId_companyId_syncedAt_idx" ON "InvoiceSnapshot"("tenantId", "companyId", "syncedAt");

-- CreateIndex
CREATE INDEX "InvoiceSnapshot_poId_idx" ON "InvoiceSnapshot"("poId");

-- CreateIndex
CREATE INDEX "InvoiceSnapshot_poNumber_idx" ON "InvoiceSnapshot"("poNumber");

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "RFQAward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RFQ"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_prId_fkey" FOREIGN KEY ("prId") REFERENCES "PurchaseRequisition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POChangeRequest" ADD CONSTRAINT "POChangeRequest_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceSnapshot" ADD CONSTRAINT "InvoiceSnapshot_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
