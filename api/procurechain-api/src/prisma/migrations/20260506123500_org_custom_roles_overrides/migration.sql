ALTER TABLE "OrganizationAdminSettings"
ADD COLUMN IF NOT EXISTS "customRoles" JSONB,
ADD COLUMN IF NOT EXISTS "userPermissionOverrides" JSONB;
