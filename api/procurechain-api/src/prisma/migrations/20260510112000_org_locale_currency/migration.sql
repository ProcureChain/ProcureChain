-- Add org-level locale defaults for country rollout support
ALTER TABLE "OrganizationProfile"
  ADD COLUMN IF NOT EXISTS "preferredLanguage" TEXT DEFAULT 'en-ZA',
  ADD COLUMN IF NOT EXISTS "preferredCurrency" TEXT DEFAULT 'ZAR';

UPDATE "OrganizationProfile"
SET
  "preferredLanguage" = COALESCE("preferredLanguage", 'en-ZA'),
  "preferredCurrency" = COALESCE("preferredCurrency", 'ZAR');
