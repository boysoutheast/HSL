CREATE TABLE IF NOT EXISTS "meta_posts" (
  "id" TEXT NOT NULL,
  "meta_account_id" TEXT NOT NULL,
  "meta_page_id" TEXT,
  "meta_post_id" TEXT,
  "platform" TEXT NOT NULL DEFAULT 'facebook',
  "post_type" TEXT NOT NULL DEFAULT 'feed',
  "title" TEXT,
  "message" TEXT,
  "media_urls_json" TEXT,
  "link_url" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "published_at" TIMESTAMP(3),
  "last_synced_at" TIMESTAMP(3),
  "raw_json" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "meta_posts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "meta_posts_meta_account_id_meta_post_id_key" ON "meta_posts"("meta_account_id", "meta_post_id");
CREATE INDEX IF NOT EXISTS "meta_posts_meta_account_id_status_idx" ON "meta_posts"("meta_account_id", "status");
CREATE INDEX IF NOT EXISTS "meta_posts_meta_page_id_idx" ON "meta_posts"("meta_page_id");
ALTER TABLE "meta_posts" ADD CONSTRAINT "meta_posts_meta_account_id_fkey" FOREIGN KEY ("meta_account_id") REFERENCES "meta_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meta_posts" ADD CONSTRAINT "meta_posts_meta_page_id_fkey" FOREIGN KEY ("meta_page_id") REFERENCES "meta_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "meta_schedules" (
  "id" TEXT NOT NULL,
  "meta_account_id" TEXT NOT NULL,
  "meta_page_id" TEXT,
  "meta_post_id" TEXT,
  "title" TEXT,
  "platform" TEXT NOT NULL DEFAULT 'facebook',
  "post_type" TEXT NOT NULL DEFAULT 'feed',
  "payload_json" TEXT NOT NULL,
  "scheduled_for" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "execute_after" TIMESTAMP(3),
  "last_error" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "published_meta_post_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "meta_schedules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "meta_schedules_meta_account_id_status_scheduled_for_idx" ON "meta_schedules"("meta_account_id", "status", "scheduled_for");
CREATE INDEX IF NOT EXISTS "meta_schedules_meta_page_id_idx" ON "meta_schedules"("meta_page_id");
ALTER TABLE "meta_schedules" ADD CONSTRAINT "meta_schedules_meta_account_id_fkey" FOREIGN KEY ("meta_account_id") REFERENCES "meta_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meta_schedules" ADD CONSTRAINT "meta_schedules_meta_page_id_fkey" FOREIGN KEY ("meta_page_id") REFERENCES "meta_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "meta_schedules" ADD CONSTRAINT "meta_schedules_meta_post_id_fkey" FOREIGN KEY ("meta_post_id") REFERENCES "meta_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "auto_reply_rules" (
  "id" TEXT NOT NULL,
  "meta_account_id" TEXT NOT NULL,
  "meta_page_id" TEXT,
  "name" TEXT NOT NULL,
  "trigger_type" TEXT NOT NULL DEFAULT 'contains',
  "trigger_value" TEXT NOT NULL,
  "response_type" TEXT NOT NULL DEFAULT 'static',
  "response_value" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "match_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "auto_reply_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "auto_reply_rules_meta_account_id_is_active_idx" ON "auto_reply_rules"("meta_account_id", "is_active");
CREATE INDEX IF NOT EXISTS "auto_reply_rules_meta_page_id_idx" ON "auto_reply_rules"("meta_page_id");
ALTER TABLE "auto_reply_rules" ADD CONSTRAINT "auto_reply_rules_meta_account_id_fkey" FOREIGN KEY ("meta_account_id") REFERENCES "meta_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auto_reply_rules" ADD CONSTRAINT "auto_reply_rules_meta_page_id_fkey" FOREIGN KEY ("meta_page_id") REFERENCES "meta_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "meta_chat_threads" (
  "id" TEXT NOT NULL,
  "meta_account_id" TEXT NOT NULL,
  "meta_page_id" TEXT,
  "thread_meta_id" TEXT NOT NULL,
  "customer_meta_id" TEXT,
  "customer_name" TEXT,
  "platform" TEXT NOT NULL DEFAULT 'facebook',
  "unread_count" INTEGER NOT NULL DEFAULT 0,
  "last_message_at" TIMESTAMP(3),
  "last_synced_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "meta_chat_threads_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "meta_chat_threads_meta_account_id_thread_meta_id_key" ON "meta_chat_threads"("meta_account_id", "thread_meta_id");
CREATE INDEX IF NOT EXISTS "meta_chat_threads_meta_account_id_last_message_at_idx" ON "meta_chat_threads"("meta_account_id", "last_message_at");
ALTER TABLE "meta_chat_threads" ADD CONSTRAINT "meta_chat_threads_meta_account_id_fkey" FOREIGN KEY ("meta_account_id") REFERENCES "meta_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meta_chat_threads" ADD CONSTRAINT "meta_chat_threads_meta_page_id_fkey" FOREIGN KEY ("meta_page_id") REFERENCES "meta_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "meta_chat_messages" (
  "id" TEXT NOT NULL,
  "thread_id" TEXT NOT NULL,
  "message_meta_id" TEXT NOT NULL,
  "sender_meta_id" TEXT,
  "sender_name" TEXT,
  "body" TEXT,
  "direction" TEXT NOT NULL DEFAULT 'inbound',
  "attachment_json" TEXT,
  "read_at" TIMESTAMP(3),
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "meta_chat_messages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "meta_chat_messages_thread_id_message_meta_id_key" ON "meta_chat_messages"("thread_id", "message_meta_id");
CREATE INDEX IF NOT EXISTS "meta_chat_messages_thread_id_sent_at_idx" ON "meta_chat_messages"("thread_id", "sent_at");
ALTER TABLE "meta_chat_messages" ADD CONSTRAINT "meta_chat_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "meta_chat_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "meta_post_stats" (
  "id" TEXT NOT NULL,
  "meta_post_id" TEXT NOT NULL,
  "stat_date" TIMESTAMP(3) NOT NULL,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "reach" INTEGER NOT NULL DEFAULT 0,
  "reactions" INTEGER NOT NULL DEFAULT 0,
  "comments" INTEGER NOT NULL DEFAULT 0,
  "shares" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "raw_json" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "meta_post_stats_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "meta_post_stats_meta_post_id_stat_date_key" ON "meta_post_stats"("meta_post_id", "stat_date");
CREATE INDEX IF NOT EXISTS "meta_post_stats_stat_date_idx" ON "meta_post_stats"("stat_date");
ALTER TABLE "meta_post_stats" ADD CONSTRAINT "meta_post_stats_meta_post_id_fkey" FOREIGN KEY ("meta_post_id") REFERENCES "meta_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
