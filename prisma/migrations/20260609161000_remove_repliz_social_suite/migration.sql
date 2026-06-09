-- Remove Repliz-like social suite tables from HSL
-- Kept: meta_accounts, meta_businesses, meta_ad_accounts, meta_pages, test_launches, worker_tasks

DROP TABLE IF EXISTS "meta_post_stats" CASCADE;
DROP TABLE IF EXISTS "meta_chat_messages" CASCADE;
DROP TABLE IF EXISTS "meta_chat_threads" CASCADE;
DROP TABLE IF EXISTS "auto_reply_rules" CASCADE;
DROP TABLE IF EXISTS "meta_schedules" CASCADE;
DROP TABLE IF EXISTS "meta_posts" CASCADE;
DROP TABLE IF EXISTS "meta_comments" CASCADE;