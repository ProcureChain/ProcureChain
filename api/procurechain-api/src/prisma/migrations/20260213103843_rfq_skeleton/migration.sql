-- CreateEnum
CREATE TYPE "RFQStatus" AS ENUM ('DRAFT', 'ISSUED', 'CLOSED');

-- CreateTable
CREATE TABLE "RFQ" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "prId" TEXT NOT NULL,
    "status" "RFQStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "title" TEXT,
    "notes" TEXT,

    CONSTRAINT "RFQ_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RFQSupplier" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rfqId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3),

    CONSTRAINT "RFQSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RFQ_prId_key" ON "RFQ"("prId");

-- CreateIndex
CREATE INDEX "RFQ_tenantId_companyId_createdAt_idx" ON "RFQ"("tenantId", "companyId", "createdAt");

-- CreateIndex
CREATE INDEX "RFQ_status_createdAt_idx" ON "RFQ"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RFQSupplier_supplierId_idx" ON "RFQSupplier"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "RFQSupplier_rfqId_supplierId_key" ON "RFQSupplier"("rfqId", "supplierId");

-- AddForeignKey
ALTER TABLE "RFQ" ADD CONSTRAINT "RFQ_prId_fkey" FOREIGN KEY ("prId") REFERENCES "PurchaseRequisition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFQSupplier" ADD CONSTRAINT "RFQSupplier_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RFQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFQSupplier" ADD CONSTRAINT "RFQSupplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
