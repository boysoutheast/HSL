-- Add importError column to CampaignSession (additive)
ALTER TABLE "campaign_sessions" ADD COLUMN IF NOT EXISTS "import_error_message" TEXT;
