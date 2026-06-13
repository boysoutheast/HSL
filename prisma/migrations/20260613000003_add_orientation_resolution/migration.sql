-- AlterTable
ALTER TABLE "generated_media" ADD COLUMN IF NOT EXISTS "orientation" TEXT NOT NULL DEFAULT 'portrait';
ALTER TABLE "generated_media" ADD COLUMN IF NOT EXISTS "resolution" TEXT NOT NULL DEFAULT 'SD';
