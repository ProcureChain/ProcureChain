ALTER TABLE "Subcategory"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "companyId" TEXT,
  ADD COLUMN IF NOT EXISTS "isCustom" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "inheritsFromSubcategoryId" TEXT;

ALTER TABLE "Subcategory"
  ADD CONSTRAINT "Subcategory_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Subcategory"
  ADD CONSTRAINT "Subcategory_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Subcategory"
  ADD CONSTRAINT "Subcategory_inheritsFromSubcategoryId_fkey"
  FOREIGN KEY ("inheritsFromSubcategoryId") REFERENCES "Subcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Subcategory_tenantId_companyId_isCustom_level1_level2_idx"
  ON "Subcategory"("tenantId", "companyId", "isCustom", "level1", "level2");

CREATE UNIQUE INDEX IF NOT EXISTS "Subcategory_custom_scope_level3_unique_idx"
  ON "Subcategory"("tenantId", "companyId", "level1", "level2", "level3")
  WHERE "isCustom" = true;
