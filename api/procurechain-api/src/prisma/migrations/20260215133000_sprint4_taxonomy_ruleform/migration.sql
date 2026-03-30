-- CreateTable
CREATE TABLE "SubcategoryRuleFormConfig" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "subcategoryId" TEXT NOT NULL,
    "prFormKey" TEXT NOT NULL,
    "rfqFormKey" TEXT NOT NULL,
    "bidFormKey" TEXT NOT NULL,
    "prRulePackKey" TEXT NOT NULL,
    "rfqRulePackKey" TEXT NOT NULL,
    "bidRulePackKey" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "SubcategoryRuleFormConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubcategoryRuleFormOverlay" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "subcategoryId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "prFormKey" TEXT,
    "rfqFormKey" TEXT,
    "bidFormKey" TEXT,
    "prRulePackKey" TEXT,
    "rfqRulePackKey" TEXT,
    "bidRulePackKey" TEXT,
    "metadata" JSONB,

    CONSTRAINT "SubcategoryRuleFormOverlay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubcategoryRuleFormConfig_subcategoryId_key" ON "SubcategoryRuleFormConfig"("subcategoryId");

-- CreateIndex
CREATE INDEX "SubcategoryRuleFormConfig_prRulePackKey_idx" ON "SubcategoryRuleFormConfig"("prRulePackKey");

-- CreateIndex
CREATE INDEX "SubcategoryRuleFormConfig_rfqRulePackKey_idx" ON "SubcategoryRuleFormConfig"("rfqRulePackKey");

-- CreateIndex
CREATE INDEX "SubcategoryRuleFormConfig_bidRulePackKey_idx" ON "SubcategoryRuleFormConfig"("bidRulePackKey");

-- CreateIndex
CREATE INDEX "SubcategoryRuleFormOverlay_countryCode_idx" ON "SubcategoryRuleFormOverlay"("countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "SubcategoryRuleFormOverlay_subcategoryId_countryCode_key" ON "SubcategoryRuleFormOverlay"("subcategoryId", "countryCode");

-- AddForeignKey
ALTER TABLE "SubcategoryRuleFormConfig" ADD CONSTRAINT "SubcategoryRuleFormConfig_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcategoryRuleFormOverlay" ADD CONSTRAINT "SubcategoryRuleFormOverlay_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
