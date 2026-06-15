-- AlterTable
ALTER TABLE "campaign_sessions" ADD COLUMN     "adset_cap" INTEGER,
ADD COLUMN     "meta_campaign_id" TEXT;

-- AlterTable
ALTER TABLE "ceps" ADD COLUMN     "adset_naming" TEXT,
ADD COLUMN     "delivery_style" TEXT,
ADD COLUMN     "exchange_value" TEXT,
ADD COLUMN     "hook_direction" TEXT,
ADD COLUMN     "spawn_job_id" TEXT;

-- AlterTable
ALTER TABLE "metric_snapshots" ADD COLUMN     "add_to_cart_count" INTEGER,
ADD COLUMN     "catalog_segment_purchases" INTEGER,
ADD COLUMN     "catalog_segment_roas" DOUBLE PRECISION,
ADD COLUMN     "catalog_segment_value" DOUBLE PRECISION,
ADD COLUMN     "cplc" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "cpas_graveyard" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "campaign_session_id" TEXT,
    "meta_adset_id" TEXT NOT NULL,
    "adset_name" TEXT NOT NULL,
    "campaign_name" TEXT NOT NULL,
    "product_key" TEXT NOT NULL,
    "kill_tier" TEXT NOT NULL,
    "kill_reason" TEXT NOT NULL,
    "spend_at_kill" DOUBLE PRECISION NOT NULL,
    "roas_at_kill" DOUBLE PRECISION,
    "catalog_roas_at_kill" DOUBLE PRECISION,
    "purchases_at_kill" INTEGER,
    "cplc_at_kill" DOUBLE PRECISION,
    "cep_text" TEXT,
    "exchange_value" TEXT,
    "delivery_style" TEXT,
    "kill_count" INTEGER NOT NULL DEFAULT 1,
    "first_killed_at" TIMESTAMP(3) NOT NULL,
    "last_killed_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cpas_graveyard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cpas_diary" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "product_key" TEXT,
    "total_spend_7d" DOUBLE PRECISION,
    "total_purchases_7d" INTEGER,
    "avg_roas_7d" DOUBLE PRECISION,
    "active_adsets" INTEGER,
    "killed_this_run" INTEGER,
    "spawned_this_run" INTEGER,
    "revived_this_run" INTEGER,
    "top_winner_cep" TEXT,
    "summary_text" TEXT,
    "delta_vs_prev_run" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cpas_diary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cpas_lessons" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_key" TEXT,
    "lesson_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "evidence_count" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cpas_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cpas_pain_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT,
    "product_key" TEXT NOT NULL,
    "pain_text" TEXT NOT NULL,
    "exchange_values" TEXT[],
    "delivery_styles" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cpas_pain_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cpas_graveyard_product_key_last_killed_at_idx" ON "cpas_graveyard"("product_key", "last_killed_at");

-- CreateIndex
CREATE INDEX "cpas_graveyard_user_id_created_at_idx" ON "cpas_graveyard"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "cpas_graveyard_meta_adset_id_idx" ON "cpas_graveyard"("meta_adset_id");

-- CreateIndex
CREATE INDEX "cpas_diary_user_id_period_idx" ON "cpas_diary"("user_id", "period");

-- CreateIndex
CREATE INDEX "cpas_lessons_user_id_product_key_lesson_type_idx" ON "cpas_lessons"("user_id", "product_key", "lesson_type");

-- CreateIndex
CREATE INDEX "cpas_pain_entries_product_key_is_active_idx" ON "cpas_pain_entries"("product_key", "is_active");

-- AddForeignKey
ALTER TABLE "cpas_graveyard" ADD CONSTRAINT "cpas_graveyard_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpas_graveyard" ADD CONSTRAINT "cpas_graveyard_campaign_session_id_fkey" FOREIGN KEY ("campaign_session_id") REFERENCES "campaign_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpas_diary" ADD CONSTRAINT "cpas_diary_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpas_lessons" ADD CONSTRAINT "cpas_lessons_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpas_pain_entries" ADD CONSTRAINT "cpas_pain_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpas_pain_entries" ADD CONSTRAINT "cpas_pain_entries_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
