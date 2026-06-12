-- CreateTable: meta_accounts
CREATE TABLE IF NOT EXISTS "meta_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ad_account_id" TEXT NOT NULL,
    "account_name" TEXT,
    "access_token" TEXT NOT NULL,
    "page_id" TEXT,
    "ig_account_id" TEXT,
    "pixel_id" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    "status" TEXT NOT NULL DEFAULT 'connected',
    "last_sync_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: test_launches
CREATE TABLE IF NOT EXISTS "test_launches" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "meta_account_id" TEXT NOT NULL,
    "product_id" TEXT,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL DEFAULT 'OUTCOME_LEADS',
    "daily_budget" DECIMAL(12,2) NOT NULL,
    "targeting_json" TEXT,
    "launch_mode" TEXT NOT NULL DEFAULT 'new_test',
    "source_adset_id" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_launches_pkey" PRIMARY KEY ("id")
);

-- CreateTable: test_launch_creatives
CREATE TABLE IF NOT EXISTS "test_launch_creatives" (
    "id" TEXT NOT NULL,
    "test_launch_id" TEXT NOT NULL,
    "creative_url" TEXT,
    "caption_text" TEXT,
    "hook_text" TEXT,
    "headline" TEXT,
    "call_to_action" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_launch_creatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable: approval_requests
CREATE TABLE IF NOT EXISTS "approval_requests" (
    "id" TEXT NOT NULL,
    "test_launch_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "reviewed_by_id" TEXT,
    "action_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "request_note" TEXT,
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable: worker_tasks
CREATE TABLE IF NOT EXISTS "worker_tasks" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload_json" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 5,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "last_error" TEXT,
    "worker_id" TEXT,
    "test_launch_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "worker_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX IF NOT EXISTS "meta_accounts_user_id_idx" ON "meta_accounts"("user_id");
CREATE INDEX IF NOT EXISTS "test_launches_user_id_idx" ON "test_launches"("user_id");
CREATE INDEX IF NOT EXISTS "test_launches_status_idx" ON "test_launches"("status");
CREATE INDEX IF NOT EXISTS "test_launch_creatives_test_launch_id_idx" ON "test_launch_creatives"("test_launch_id");
CREATE UNIQUE INDEX IF NOT EXISTS "approval_requests_test_launch_id_key" ON "approval_requests"("test_launch_id");
CREATE INDEX IF NOT EXISTS "approval_requests_status_idx" ON "approval_requests"("status");
CREATE INDEX IF NOT EXISTS "worker_tasks_status_priority_idx" ON "worker_tasks"("status", "priority");
CREATE INDEX IF NOT EXISTS "worker_tasks_test_launch_id_idx" ON "worker_tasks"("test_launch_id");

-- AddForeignKeys
ALTER TABLE "meta_accounts" ADD CONSTRAINT "meta_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "test_launches" ADD CONSTRAINT "test_launches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "test_launches" ADD CONSTRAINT "test_launches_meta_account_id_fkey" FOREIGN KEY ("meta_account_id") REFERENCES "meta_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "test_launch_creatives" ADD CONSTRAINT "test_launch_creatives_test_launch_id_fkey" FOREIGN KEY ("test_launch_id") REFERENCES "test_launches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_test_launch_id_fkey" FOREIGN KEY ("test_launch_id") REFERENCES "test_launches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "worker_tasks" ADD CONSTRAINT "worker_tasks_test_launch_id_fkey" FOREIGN KEY ("test_launch_id") REFERENCES "test_launches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
