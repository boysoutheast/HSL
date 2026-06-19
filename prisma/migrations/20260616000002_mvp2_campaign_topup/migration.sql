-- MVP2: Campaign Min-Ads Floor + Creative Pool Top-Up
-- Migration 20260616000002_mvp2_campaign_topup
-- IF NOT EXISTS, NO DEFAULT cuid(), camelCase wajib @map snake_case

-- Floor setting per campaign
ALTER TABLE campaign_sessions
  ADD COLUMN IF NOT EXISTS min_active_ads        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS topup_enabled          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS topup_target_adset_id  TEXT;

-- Pool creative khusus campaign
CREATE TABLE IF NOT EXISTS campaign_creative_pool (
  id                  TEXT PRIMARY KEY,
  campaign_session_id TEXT NOT NULL REFERENCES campaign_sessions(id) ON DELETE CASCADE,
  user_id             TEXT NOT NULL,
  primary_text        TEXT NOT NULL,
  headline            TEXT,
  description         TEXT,
  call_to_action      TEXT NOT NULL DEFAULT 'LEARN_MORE',
  link_url            TEXT,
  media_asset_id      TEXT,
  creative_url        TEXT,
  format              TEXT NOT NULL DEFAULT 'single',
  sort_order          INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'available',    -- available|used|failed|archived
  used_at             TIMESTAMPTZ,
  used_meta_ad_id     TEXT,
  failed_reason       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ccp_session_status ON campaign_creative_pool(campaign_session_id, status);
CREATE INDEX IF NOT EXISTS idx_ccp_user ON campaign_creative_pool(user_id);

-- Audit top-up event
CREATE TABLE IF NOT EXISTS campaign_topup_log (
  id                   TEXT PRIMARY KEY,
  campaign_session_id  TEXT NOT NULL REFERENCES campaign_sessions(id) ON DELETE CASCADE,
  triggered_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active_ads_before    INTEGER NOT NULL,
  min_active_ads       INTEGER NOT NULL,
  pool_creative_id     TEXT,
  automation_action_id TEXT,
  status               TEXT NOT NULL DEFAULT 'pending',     -- pending|succeeded|failed|skipped_empty_pool
  note                 TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topup_log_session ON campaign_topup_log(campaign_session_id, triggered_at);
