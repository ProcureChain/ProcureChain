ALTER TABLE "Subcategory"
  ADD COLUMN IF NOT EXISTS "supplierId" TEXT;

ALTER TABLE "Subcategory"
  ADD CONSTRAINT "Subcategory_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Subcategory_tenantId_companyId_isCustom_level1_level2_idx";
CREATE INDEX IF NOT EXISTS "Subcategory_tenantId_companyId_supplierId_isCustom_level1_level2_idx"
  ON "Subcategory"("tenantId", "companyId", "supplierId", "isCustom", "level1", "level2");

DROP INDEX IF EXISTS "Subcategory_custom_scope_level3_unique_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "Subcategory_custom_scope_level3_unique_idx"
  ON "Subcategory"("tenantId", "companyId", "supplierId", "level1", "level2", "level3")
  WHERE "isCustom" = true;
