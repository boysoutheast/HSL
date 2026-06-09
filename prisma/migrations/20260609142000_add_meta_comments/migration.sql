CREATE TABLE IF NOT EXISTS "meta_comments" (
  "id" TEXT NOT NULL,
  "meta_account_id" TEXT NOT NULL,
  "meta_page_id" TEXT,
  "meta_comment_id" TEXT NOT NULL,
  "meta_post_id" TEXT,
  "platform" TEXT NOT NULL DEFAULT 'facebook',
  "author_name" TEXT,
  "author_meta_id" TEXT,
  "message" TEXT NOT NULL,
  "sentiment" TEXT NOT NULL DEFAULT 'neutral',
  "moderation_state" TEXT NOT NULL DEFAULT 'pending',
  "replied_at" TIMESTAMP(3),
  "deleted_at" TIMESTAMP(3),
  "commented_at" TIMESTAMP(3),
  "fetched_at" TIMESTAMP(3),
  "raw_json" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "meta_comments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "meta_comments_meta_account_id_meta_comment_id_key"
  ON "meta_comments"("meta_account_id", "meta_comment_id");

CREATE INDEX IF NOT EXISTS "meta_comments_meta_account_id_moderation_state_idx"
  ON "meta_comments"("meta_account_id", "moderation_state");

CREATE INDEX IF NOT EXISTS "meta_comments_meta_page_id_idx"
  ON "meta_comments"("meta_page_id");

CREATE INDEX IF NOT EXISTS "meta_comments_commented_at_idx"
  ON "meta_comments"("commented_at");

ALTER TABLE "meta_comments"
  ADD CONSTRAINT "meta_comments_meta_account_id_fkey"
  FOREIGN KEY ("meta_account_id") REFERENCES "meta_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "meta_comments"
  ADD CONSTRAINT "meta_comments_meta_page_id_fkey"
  FOREIGN KEY ("meta_page_id") REFERENCES "meta_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
