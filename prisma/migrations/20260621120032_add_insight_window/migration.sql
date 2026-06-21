-- Add insightWindow to CampaignSession
ALTER TABLE "campaign_sessions" ADD COLUMN IF NOT EXISTS "insight_window" VARCHAR(255) NOT NULL DEFAULT 'maximum';
