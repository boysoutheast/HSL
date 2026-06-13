-- F0 hardening: composite tenant query index
CREATE INDEX IF NOT EXISTS "meta_accounts_user_id_status_idx"
ON "meta_accounts"("user_id", "status");
