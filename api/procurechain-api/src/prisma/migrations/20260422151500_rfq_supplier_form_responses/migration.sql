CREATE TABLE IF NOT EXISTS "RFQSupplierFormResponse" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "rfqId" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "response" JSONB,
  "documents" JSONB,
  "isComplete" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "submittedBy" TEXT,
  CONSTRAINT "RFQSupplierFormResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RFQSupplierFormResponse_assignmentId_supplierId_key"
  ON "RFQSupplierFormResponse"("assignmentId", "supplierId");

CREATE INDEX IF NOT EXISTS "RFQSupplierFormResponse_tenant_company_rfq_supplier_created_idx"
  ON "RFQSupplierFormResponse"("tenantId", "companyId", "rfqId", "supplierId", "createdAt");

ALTER TABLE "RFQSupplierFormResponse"
  ADD CONSTRAINT "RFQSupplierFormResponse_rfqId_fkey"
  FOREIGN KEY ("rfqId") REFERENCES "RFQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RFQSupplierFormResponse"
  ADD CONSTRAINT "RFQSupplierFormResponse_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "RFQSupplierFormAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RFQSupplierFormResponse"
  ADD CONSTRAINT "RFQSupplierFormResponse_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "SupplierFormTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RFQSupplierFormResponse"
  ADD CONSTRAINT "RFQSupplierFormResponse_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
