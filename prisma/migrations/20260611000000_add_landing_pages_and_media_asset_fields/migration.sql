-- CreateTable: landing_pages
CREATE TABLE IF NOT EXISTS "landing_pages" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "variant" TEXT NOT NULL DEFAULT 'A',
    "type" TEXT NOT NULL DEFAULT 'shopee',
    "label" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_pages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "landing_pages_product_id_idx" ON "landing_pages"("product_id");

ALTER TABLE "landing_pages" ADD CONSTRAINT "landing_pages_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddColumns to media_assets (all optional/with defaults to avoid breaking existing rows)
ALTER TABLE "media_assets"
    ADD COLUMN IF NOT EXISTS "character_id" TEXT,
    ADD COLUMN IF NOT EXISTS "instagram_account_id" TEXT,
    ADD COLUMN IF NOT EXISTS "topic_id" TEXT,
    ADD COLUMN IF NOT EXISTS "label" TEXT,
    ADD COLUMN IF NOT EXISTS "category" TEXT,
    ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS "file_url" TEXT,
    ADD COLUMN IF NOT EXISTS "thumbnail_url" TEXT,
    ADD COLUMN IF NOT EXISTS "duration" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "aspect_ratio" TEXT;

-- Indexes for media_assets new columns
CREATE INDEX IF NOT EXISTS "media_assets_character_id_idx" ON "media_assets"("character_id");
CREATE INDEX IF NOT EXISTS "media_assets_instagram_account_id_idx" ON "media_assets"("instagram_account_id");
CREATE INDEX IF NOT EXISTS "media_assets_product_id_idx" ON "media_assets"("product_id");

-- FK constraints for media_assets new columns
ALTER TABLE "media_assets"
    ADD CONSTRAINT "media_assets_character_id_fkey"
        FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "media_assets"
    ADD CONSTRAINT "media_assets_instagram_account_id_fkey"
        FOREIGN KEY ("instagram_account_id") REFERENCES "instagram_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "media_assets"
    ADD CONSTRAINT "media_assets_topic_id_fkey"
        FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
