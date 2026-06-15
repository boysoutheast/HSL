-- CreditTransaction: tambah receipt hash
ALTER TABLE credit_transactions
  ADD COLUMN IF NOT EXISTS tx_hash TEXT UNIQUE;

-- GeneratedMedia: tambah delivery hash + revoke tracking
ALTER TABLE generated_media
  ADD COLUMN IF NOT EXISTS media_hash      TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS media_hash_revoked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_credit_transactions_tx_hash ON credit_transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_generated_media_media_hash  ON generated_media(media_hash);
