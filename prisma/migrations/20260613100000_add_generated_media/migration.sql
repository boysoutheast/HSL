CREATE TABLE IF NOT EXISTS generated_media (
  id                   TEXT        NOT NULL PRIMARY KEY,
  source               TEXT        NOT NULL DEFAULT 'geminigen',
  model                TEXT        NOT NULL DEFAULT 'grok-video',
  external_job_id      TEXT        UNIQUE,
  status               TEXT        NOT NULL DEFAULT 'queued',
  prompt               TEXT        NOT NULL,
  instagram_account_id TEXT        REFERENCES instagram_accounts(id) ON DELETE SET NULL,
  worker_task_id       TEXT        REFERENCES worker_tasks(id) ON DELETE SET NULL,
  video_url            TEXT,
  thumbnail_url        TEXT,
  duration_seconds     INTEGER     NOT NULL DEFAULT 10,
  raw_webhook_json     TEXT,
  raw_history_json     TEXT,
  error_message        TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_generated_media_status
  ON generated_media(status);
CREATE INDEX IF NOT EXISTS idx_generated_media_external_job_id
  ON generated_media(external_job_id);
CREATE INDEX IF NOT EXISTS idx_generated_media_account
  ON generated_media(instagram_account_id);

CREATE TABLE IF NOT EXISTS generated_media_inputs (
  id                   TEXT    NOT NULL PRIMARY KEY,
  generated_media_id   TEXT    NOT NULL REFERENCES generated_media(id) ON DELETE CASCADE,
  photo_reference_id   TEXT    NOT NULL REFERENCES photo_references(id),
  input_order          INTEGER NOT NULL DEFAULT 0
);
