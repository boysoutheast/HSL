-- Add enabledForAutomation flag to MetaAdAccount
-- Default true = back-compat (existing accounts stay enabled)
ALTER TABLE "meta_ad_accounts" ADD COLUMN IF NOT EXISTS "enabled_for_automation" BOOLEAN NOT NULL DEFAULT true;
