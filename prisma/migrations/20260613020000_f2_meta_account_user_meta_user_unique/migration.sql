-- F2 callback sync: one Meta user connection per HSL user
CREATE UNIQUE INDEX IF NOT EXISTS "meta_accounts_user_id_meta_user_id_key"
ON "meta_accounts"("user_id", "meta_user_id");
