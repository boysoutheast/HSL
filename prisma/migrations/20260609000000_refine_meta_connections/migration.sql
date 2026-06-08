-- Migration: 20260609000000_refine_meta_connections
-- Extends MetaAccount, adds MetaBusiness, MetaAdAccount, MetaPage
-- Extends TestLaunch with per-launch page/IG/placement/audience/currency/destination

-- ──────────────────────────────────────────────
-- 1. ALTER meta_accounts — add new columns
-- ──────────────────────────────────────────────
ALTER TABLE meta_accounts
  ADD COLUMN IF NOT EXISTS name                         TEXT,
  ADD COLUMN IF NOT EXISTS app_id                       TEXT,
  ADD COLUMN IF NOT EXISTS app_secret_encrypted         TEXT,
  ADD COLUMN IF NOT EXISTS short_lived_token_encrypted  TEXT,
  ADD COLUMN IF NOT EXISTS long_lived_token_encrypted   TEXT,
  ADD COLUMN IF NOT EXISTS token_expiry                 TIMESTAMP,
  ADD COLUMN IF NOT EXISTS meta_user_id                 TEXT,
  ADD COLUMN IF NOT EXISTS meta_user_name               TEXT,
  ADD COLUMN IF NOT EXISTS scopes_json                  TEXT,
  ADD COLUMN IF NOT EXISTS default_ad_account_id        TEXT,
  ADD COLUMN IF NOT EXISTS last_meta_call_at            TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_token_check_at          TIMESTAMP;

-- Rename access_token → (keep as legacy, but add encrypted variants above)
-- access_token column kept for backward compat; nulled out later
-- account_name already exists; keep as-is

-- ──────────────────────────────────────────────
-- 2. CREATE meta_businesses
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meta_businesses (
  id                   TEXT PRIMARY KEY,
  meta_account_id      TEXT NOT NULL REFERENCES meta_accounts(id) ON DELETE CASCADE,
  business_id          TEXT NOT NULL,
  business_name        TEXT,
  verification_status  TEXT,
  is_selected          BOOLEAN NOT NULL DEFAULT FALSE,
  last_synced_at       TIMESTAMP,
  created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS meta_businesses_meta_account_id_idx ON meta_businesses(meta_account_id);
CREATE INDEX IF NOT EXISTS meta_businesses_business_id_idx ON meta_businesses(business_id);

-- ──────────────────────────────────────────────
-- 3. CREATE meta_ad_accounts
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meta_ad_accounts (
  id               TEXT PRIMARY KEY,
  meta_account_id  TEXT NOT NULL REFERENCES meta_accounts(id) ON DELETE CASCADE,
  meta_business_id TEXT REFERENCES meta_businesses(id),
  business_id      TEXT,
  ad_account_id    TEXT NOT NULL,
  ad_account_name  TEXT,
  account_status   INTEGER NOT NULL DEFAULT 1,
  currency         TEXT,
  timezone_name    TEXT,
  is_default       BOOLEAN NOT NULL DEFAULT FALSE,
  last_synced_at   TIMESTAMP,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS meta_ad_accounts_meta_account_id_idx ON meta_ad_accounts(meta_account_id);
CREATE INDEX IF NOT EXISTS meta_ad_accounts_ad_account_id_idx ON meta_ad_accounts(ad_account_id);
CREATE INDEX IF NOT EXISTS meta_ad_accounts_business_id_idx ON meta_ad_accounts(business_id);

-- ──────────────────────────────────────────────
-- 4. CREATE meta_pages
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meta_pages (
  id                          TEXT PRIMARY KEY,
  meta_account_id             TEXT NOT NULL REFERENCES meta_accounts(id) ON DELETE CASCADE,
  page_id                     TEXT NOT NULL,
  page_name                   TEXT,
  page_access_token_encrypted TEXT,
  ig_business_account_id      TEXT,
  ig_username                 TEXT,
  ig_name                     TEXT,
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at              TIMESTAMP,
  created_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS meta_pages_meta_account_id_idx ON meta_pages(meta_account_id);
CREATE INDEX IF NOT EXISTS meta_pages_page_id_idx ON meta_pages(page_id);

-- ──────────────────────────────────────────────
-- 5. ALTER test_launches — extend fields
-- ──────────────────────────────────────────────
ALTER TABLE test_launches
  ADD COLUMN IF NOT EXISTS meta_business_id    TEXT,
  ADD COLUMN IF NOT EXISTS meta_ad_account_id  TEXT,
  ADD COLUMN IF NOT EXISTS currency            TEXT NOT NULL DEFAULT 'IDR',
  ADD COLUMN IF NOT EXISTS page_id             TEXT,
  ADD COLUMN IF NOT EXISTS ig_account_id       TEXT,
  ADD COLUMN IF NOT EXISTS placement_mode      TEXT NOT NULL DEFAULT 'automatic',
  ADD COLUMN IF NOT EXISTS placements_json     TEXT,
  ADD COLUMN IF NOT EXISTS audience_json       TEXT,
  ADD COLUMN IF NOT EXISTS destination_url     TEXT;

-- ──────────────────────────────────────────────
-- 6. ALTER test_launch_creatives — add primaryText + adHeadline
-- ──────────────────────────────────────────────
ALTER TABLE test_launch_creatives
  ADD COLUMN IF NOT EXISTS primary_text  TEXT,
  ADD COLUMN IF NOT EXISTS ad_headline   TEXT;
