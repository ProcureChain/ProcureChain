DELETE FROM "Subcategory"
WHERE "isCustom" = true
  AND "supplierId" IS NOT NULL;

DROP INDEX IF EXISTS "Subcategory_custom_scope_level3_unique_idx";
DROP INDEX IF EXISTS "Subcategory_tenantId_companyId_supplierId_isCustom_level1_level2_idx";
DROP INDEX IF EXISTS "Subcategory_tenantId_companyId_supplierId_isCustom_level1_level";

CREATE INDEX IF NOT EXISTS "Subcategory_tenantId_companyId_isCustom_level1_level2_idx"
  ON "Subcategory"("tenantId", "companyId", "isCustom", "level1", "level2");

CREATE UNIQUE INDEX IF NOT EXISTS "Subcategory_custom_scope_level3_unique_idx"
  ON "Subcategory"("tenantId", "companyId", "level1", "level2", "level3")
  WHERE "isCustom" = true;

ALTER TABLE "Subcategory"
  DROP CONSTRAINT IF EXISTS "Subcategory_supplierId_fkey";

ALTER TABLE "Subcategory"
  DROP COLUMN IF EXISTS "supplierId";
