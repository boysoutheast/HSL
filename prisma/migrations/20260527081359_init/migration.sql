-- CreateTable
CREATE TABLE "hermes_agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "api_key_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hermes_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instagram_accounts" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "account_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "purpose" TEXT,
    "notes" TEXT,
    "last_post_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "characters" (
    "id" TEXT NOT NULL,
    "instagram_account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "behavior" TEXT,
    "speaking_style" TEXT,
    "expression_style" TEXT,
    "movement_style" TEXT,
    "forbidden_rules" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_references" (
    "id" TEXT NOT NULL,
    "uploaded_by" TEXT,
    "file_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "label" TEXT NOT NULL,
    "category" TEXT,
    "instagram_account_id" TEXT,
    "character_id" TEXT,
    "topic_id" TEXT,
    "product_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "photo_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "instagram_account_id" TEXT,
    "character_id" TEXT,
    "product_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "main_benefit" TEXT,
    "product_url" TEXT,
    "ingredients" TEXT,
    "usage_instruction" TEXT,
    "price" DECIMAL(10,2),
    "shopee_url" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ceps" (
    "id" TEXT NOT NULL,
    "topic_id" TEXT,
    "product_id" TEXT,
    "cep_text" TEXT NOT NULL,
    "pain_point" TEXT,
    "angle" TEXT,
    "source" TEXT NOT NULL DEFAULT 'human',
    "created_by_hermes_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ceps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "hermes_agent_id" TEXT NOT NULL,
    "assignable_type" TEXT NOT NULL,
    "assignable_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_content_logs" (
    "id" TEXT NOT NULL,
    "hermes_agent_id" TEXT NOT NULL,
    "instagram_account_id" TEXT NOT NULL,
    "character_id" TEXT,
    "topic_id" TEXT,
    "cep_id" TEXT,
    "product_id" TEXT,
    "reference_image_id" TEXT,
    "prompt" TEXT NOT NULL,
    "script" TEXT,
    "caption" TEXT,
    "post_url" TEXT,
    "video_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "error_message" TEXT,
    "posted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_content_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_trackers" (
    "id" TEXT NOT NULL,
    "generated_content_log_id" TEXT NOT NULL,
    "instagram_account_id" TEXT NOT NULL,
    "post_url" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "last_checked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_trackers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_snapshots" (
    "id" TEXT NOT NULL,
    "performance_tracker_id" TEXT NOT NULL,
    "generated_content_log_id" TEXT NOT NULL,
    "instagram_account_id" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posting_monitors" (
    "id" TEXT NOT NULL,
    "instagram_account_id" TEXT NOT NULL,
    "latest_content_log_id" TEXT,
    "latest_post_url" TEXT,
    "last_post_at" TIMESTAMP(3),
    "current_views" INTEGER NOT NULL DEFAULT 0,
    "previous_views" INTEGER NOT NULL DEFAULT 0,
    "growth_per_hour" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "consecutive_stuck_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "reason" TEXT,
    "locked_until" TIMESTAMP(3),
    "assigned_hermes_id" TEXT,
    "last_metrics_check_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posting_monitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posting_monitor_settings" (
    "id" TEXT NOT NULL,
    "check_interval_minutes" INTEGER NOT NULL DEFAULT 60,
    "minimum_decision_age_minutes" INTEGER NOT NULL DEFAULT 180,
    "dead_early_age_minutes" INTEGER NOT NULL DEFAULT 120,
    "stuck_threshold_percent_per_hour" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "growing_threshold_percent_per_hour" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "hot_threshold_percent_per_hour" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "stuck_confirmation_count" INTEGER NOT NULL DEFAULT 2,
    "hot_lock_duration_minutes" INTEGER NOT NULL DEFAULT 360,
    "max_post_per_day" INTEGER NOT NULL DEFAULT 2,
    "minimum_gap_upload_minutes" INTEGER NOT NULL DEFAULT 360,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posting_monitor_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hermes_agents_api_key_hash_key" ON "hermes_agents"("api_key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_accounts_username_key" ON "instagram_accounts"("username");

-- CreateIndex
CREATE UNIQUE INDEX "assignments_hermes_agent_id_assignable_type_assignable_id_key" ON "assignments"("hermes_agent_id", "assignable_type", "assignable_id");

-- CreateIndex
CREATE UNIQUE INDEX "performance_trackers_generated_content_log_id_key" ON "performance_trackers"("generated_content_log_id");

-- CreateIndex
CREATE UNIQUE INDEX "posting_monitors_instagram_account_id_key" ON "posting_monitors"("instagram_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_instagram_account_id_fkey" FOREIGN KEY ("instagram_account_id") REFERENCES "instagram_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_references" ADD CONSTRAINT "photo_references_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_references" ADD CONSTRAINT "photo_references_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_references" ADD CONSTRAINT "photo_references_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ceps" ADD CONSTRAINT "ceps_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ceps" ADD CONSTRAINT "ceps_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_hermes_agent_id_fkey" FOREIGN KEY ("hermes_agent_id") REFERENCES "hermes_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_content_logs" ADD CONSTRAINT "generated_content_logs_hermes_agent_id_fkey" FOREIGN KEY ("hermes_agent_id") REFERENCES "hermes_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_content_logs" ADD CONSTRAINT "generated_content_logs_instagram_account_id_fkey" FOREIGN KEY ("instagram_account_id") REFERENCES "instagram_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_content_logs" ADD CONSTRAINT "generated_content_logs_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_content_logs" ADD CONSTRAINT "generated_content_logs_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_content_logs" ADD CONSTRAINT "generated_content_logs_cep_id_fkey" FOREIGN KEY ("cep_id") REFERENCES "ceps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_content_logs" ADD CONSTRAINT "generated_content_logs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_content_logs" ADD CONSTRAINT "generated_content_logs_reference_image_id_fkey" FOREIGN KEY ("reference_image_id") REFERENCES "photo_references"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_trackers" ADD CONSTRAINT "performance_trackers_generated_content_log_id_fkey" FOREIGN KEY ("generated_content_log_id") REFERENCES "generated_content_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_trackers" ADD CONSTRAINT "performance_trackers_instagram_account_id_fkey" FOREIGN KEY ("instagram_account_id") REFERENCES "instagram_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_snapshots" ADD CONSTRAINT "performance_snapshots_performance_tracker_id_fkey" FOREIGN KEY ("performance_tracker_id") REFERENCES "performance_trackers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posting_monitors" ADD CONSTRAINT "posting_monitors_instagram_account_id_fkey" FOREIGN KEY ("instagram_account_id") REFERENCES "instagram_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posting_monitors" ADD CONSTRAINT "posting_monitors_assigned_hermes_id_fkey" FOREIGN KEY ("assigned_hermes_id") REFERENCES "hermes_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
