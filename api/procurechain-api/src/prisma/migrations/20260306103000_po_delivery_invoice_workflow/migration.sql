-- CreateEnum
CREATE TYPE "DeliveryNoteStatus" AS ENUM ('RECEIVED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "InvoiceLifecycleStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'SIGNED');

-- CreateTable
CREATE TABLE "DeliveryNote" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "poId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "noteNumber" TEXT NOT NULL,
  "deliveryDate" TIMESTAMP(3) NOT NULL,
  "receivedBy" TEXT,
  "remarks" TEXT,
  "documentUrl" TEXT,
  "status" "DeliveryNoteStatus" NOT NULL DEFAULT 'RECEIVED',
  CONSTRAINT "DeliveryNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "poId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "deliveryNoteId" TEXT,
  "invoiceNumber" TEXT NOT NULL,
  "templateVersion" TEXT NOT NULL DEFAULT 'v1',
  "currency" TEXT NOT NULL DEFAULT 'ZAR',
  "subtotal" DECIMAL(18,2) NOT NULL,
  "taxAmount" DECIMAL(18,2) NOT NULL,
  "totalAmount" DECIMAL(18,2) NOT NULL,
  "taxIncluded" BOOLEAN NOT NULL DEFAULT true,
  "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" TIMESTAMP(3),
  "status" "InvoiceLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
  "buyerDetails" JSONB,
  "supplierDetails" JSONB,
  "lineItems" JSONB,
  "notes" TEXT,
  "paidAt" TIMESTAMP(3),
  "signedAt" TIMESTAMP(3),
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceSignature" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "signedBy" TEXT NOT NULL,
  "signerRole" TEXT,
  "signatureHash" TEXT NOT NULL,
  "signaturePayload" JSONB,
  CONSTRAINT "InvoiceSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProof" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "amountPaid" DECIMAL(18,2) NOT NULL,
  "paymentDate" TIMESTAMP(3) NOT NULL,
  "paymentReference" TEXT,
  "popUrl" TEXT,
  "notes" TEXT,
  "recordedBy" TEXT,
  CONSTRAINT "PaymentProof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryNote_tenantId_companyId_noteNumber_key" ON "DeliveryNote"("tenantId", "companyId", "noteNumber");
CREATE INDEX "DeliveryNote_tenantId_companyId_poId_createdAt_idx" ON "DeliveryNote"("tenantId", "companyId", "poId", "createdAt");
CREATE INDEX "DeliveryNote_supplierId_deliveryDate_idx" ON "DeliveryNote"("supplierId", "deliveryDate");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_tenantId_companyId_invoiceNumber_key" ON "Invoice"("tenantId", "companyId", "invoiceNumber");
CREATE INDEX "Invoice_tenantId_companyId_poId_status_createdAt_idx" ON "Invoice"("tenantId", "companyId", "poId", "status", "createdAt");
CREATE INDEX "Invoice_supplierId_issueDate_idx" ON "Invoice"("supplierId", "issueDate");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceSignature_invoiceId_key" ON "InvoiceSignature"("invoiceId");
CREATE INDEX "InvoiceSignature_tenantId_companyId_createdAt_idx" ON "InvoiceSignature"("tenantId", "companyId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentProof_tenantId_companyId_invoiceId_createdAt_idx" ON "PaymentProof"("tenantId", "companyId", "invoiceId", "createdAt");

-- AddForeignKey
ALTER TABLE "DeliveryNote" ADD CONSTRAINT "DeliveryNote_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryNote" ADD CONSTRAINT "DeliveryNote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_deliveryNoteId_fkey" FOREIGN KEY ("deliveryNoteId") REFERENCES "DeliveryNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvoiceSignature" ADD CONSTRAINT "InvoiceSignature_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
