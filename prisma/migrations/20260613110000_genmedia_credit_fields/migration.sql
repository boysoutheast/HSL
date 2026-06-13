-- B1-ext: GeneratedMedia credit/billing fields
-- Timestamp > 20260613100000 so it runs AFTER generated_media table creation
-- ADDITIVE ONLY — IF NOT EXISTS on all columns + constraints

-- 1. GeneratedMedia: add userId, mediaType, creditsCost, refundedAt
ALTER TABLE "generated_media" 
  ADD COLUMN IF NOT EXISTS "user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "media_type" TEXT NOT NULL DEFAULT 'VIDEO',
  ADD COLUMN IF NOT EXISTS "credits_cost" INTEGER,
  ADD COLUMN IF NOT EXISTS "refunded_at" TIMESTAMPTZ;

-- 2. FK: generated_media.user_id → admin_users.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'generated_media_user_id_fkey'
  ) THEN
    ALTER TABLE "generated_media" 
      ADD CONSTRAINT "generated_media_user_id_fkey" 
      FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
