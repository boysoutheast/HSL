ALTER TABLE "test_launches"
    ADD COLUMN IF NOT EXISTS "budget_mode" TEXT NOT NULL DEFAULT 'CBO';

CREATE TABLE IF NOT EXISTS "test_launch_adsets" (
    "id" TEXT NOT NULL,
    "test_launch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "daily_budget" DECIMAL(12,2),
    "bid_strategy_json" TEXT,
    "audience_json" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "test_launch_adsets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "test_launch_adsets_test_launch_id_fkey"
        FOREIGN KEY ("test_launch_id") REFERENCES "test_launches"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "test_launch_adsets_test_launch_id_idx"
    ON "test_launch_adsets"("test_launch_id");

ALTER TABLE "test_launch_creatives"
    ADD COLUMN IF NOT EXISTS "adset_id" TEXT;

CREATE INDEX IF NOT EXISTS "test_launch_creatives_adset_id_idx"
    ON "test_launch_creatives"("adset_id");

DO $$ BEGIN
    ALTER TABLE "test_launch_creatives"
        ADD CONSTRAINT "test_launch_creatives_adset_id_fkey"
        FOREIGN KEY ("adset_id") REFERENCES "test_launch_adsets"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
