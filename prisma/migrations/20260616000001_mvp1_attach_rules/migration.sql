-- MVP1: Attach Rules to Existing Campaign + Scan Budget
-- Migration 20260616000001_mvp1_attach_rules

-- CampaignSession: tandai source supaya bisa bedain campaign import vs launch
ALTER TABLE campaign_sessions
  ADD COLUMN IF NOT EXISTS source        TEXT NOT NULL DEFAULT 'launch',
  ADD COLUMN IF NOT EXISTS import_status TEXT;

-- AutomationRule: link balik ke template asalnya (audit + "instantiated from")
ALTER TABLE automation_rules
  ADD COLUMN IF NOT EXISTS source_template_id TEXT;

-- productId di CampaignSession jadi nullable
ALTER TABLE campaign_sessions ALTER COLUMN product_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_sessions_source ON campaign_sessions(source, status);
CREATE INDEX IF NOT EXISTS idx_automation_rules_template ON automation_rules(source_template_id);
