-- CreateTable
CREATE TABLE "SupplierFormTemplate" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "fields" JSONB NOT NULL,
  "isReusable" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  CONSTRAINT "SupplierFormTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RFQSupplierFormAssignment" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "rfqId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  CONSTRAINT "RFQSupplierFormAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierFormTemplate_tenantId_companyId_createdAt_idx" ON "SupplierFormTemplate"("tenantId", "companyId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierFormTemplate_tenantId_companyId_isReusable_isActive_c_idx" ON "SupplierFormTemplate"("tenantId", "companyId", "isReusable", "isActive", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RFQSupplierFormAssignment_rfqId_templateId_key" ON "RFQSupplierFormAssignment"("rfqId", "templateId");

-- CreateIndex
CREATE INDEX "RFQSupplierFormAssignment_tenantId_companyId_rfqId_createdAt_idx" ON "RFQSupplierFormAssignment"("tenantId", "companyId", "rfqId", "createdAt");

-- AddForeignKey
ALTER TABLE "RFQSupplierFormAssignment" ADD CONSTRAINT "RFQSupplierFormAssignment_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RFQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFQSupplierFormAssignment" ADD CONSTRAINT "RFQSupplierFormAssignment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SupplierFormTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
