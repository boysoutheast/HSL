-- Notifications system: in-app notifications for automation events
CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  severity   TEXT NOT NULL DEFAULT 'info',
  title      TEXT NOT NULL,
  body       TEXT,
  ref_type   TEXT,
  ref_id     TEXT,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_user_unread ON notifications(user_id, read_at);

-- Add telegram_chat_id to admin_users for optional Telegram notifications
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT DEFAULT NULL;
