ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "departmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "User"
SET "departmentIds" = ARRAY[]::TEXT[]
WHERE "departmentIds" IS NULL;

ALTER TABLE "User"
ALTER COLUMN "departmentIds" SET NOT NULL;
