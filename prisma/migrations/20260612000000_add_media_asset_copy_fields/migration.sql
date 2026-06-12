-- Add optional copy fields to media_assets
-- These were in schema.prisma but never migrated; causes Prisma SELECT error on all queries.
-- All nullable to avoid breaking existing rows.
ALTER TABLE "media_assets"
    ADD COLUMN IF NOT EXISTS "primary_text" VARCHAR(125),
    ADD COLUMN IF NOT EXISTS "headline"     VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "link_url"     TEXT,
    ADD COLUMN IF NOT EXISTS "cta_button"   TEXT;
