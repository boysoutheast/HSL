ALTER TABLE "test_launch_adsets"
    ADD COLUMN IF NOT EXISTS "destination_type" TEXT NOT NULL DEFAULT 'WEBSITE',
    ADD COLUMN IF NOT EXISTS "optimization_goal" TEXT,
    ADD COLUMN IF NOT EXISTS "billing_event" TEXT,
    ADD COLUMN IF NOT EXISTS "pixel_id" TEXT,
    ADD COLUMN IF NOT EXISTS "custom_event_type" TEXT,
    ADD COLUMN IF NOT EXISTS "start_time" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "end_time" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "placement_mode" TEXT NOT NULL DEFAULT 'automatic',
    ADD COLUMN IF NOT EXISTS "placements_json" TEXT,
    ADD COLUMN IF NOT EXISTS "targeting_json" TEXT,
    ADD COLUMN IF NOT EXISTS "identity_page_id" TEXT,
    ADD COLUMN IF NOT EXISTS "identity_ig_user_id" TEXT;

ALTER TABLE "test_launch_creatives"
    ADD COLUMN IF NOT EXISTS "format" TEXT NOT NULL DEFAULT 'single',
    ADD COLUMN IF NOT EXISTS "link_url" TEXT,
    ADD COLUMN IF NOT EXISTS "description" TEXT,
    ADD COLUMN IF NOT EXISTS "url_tags" TEXT,
    ADD COLUMN IF NOT EXISTS "child_attachments_json" TEXT,
    ADD COLUMN IF NOT EXISTS "video_id" TEXT;
