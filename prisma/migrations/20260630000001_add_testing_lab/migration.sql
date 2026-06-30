-- AlterTable
ALTER TABLE "generated_media" ADD COLUMN     "media_asset_id" TEXT;

-- CreateTable
CREATE TABLE "ad_tests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT,
    "campaign_session_id" TEXT,
    "test_launch_id" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "objective" TEXT NOT NULL DEFAULT 'PURCHASE',
    "success_metric" TEXT NOT NULL,
    "hypothesis" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "winner_variant_id" TEXT,
    "min_spend_per_variant" DECIMAL(12,2),
    "track" TEXT NOT NULL DEFAULT 'DIRECT',
    "auto_scale_winner" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_test_variants" (
    "id" TEXT NOT NULL,
    "ad_test_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "generated_media_id" TEXT,
    "test_launch_creative_id" TEXT,
    "creative_variant_id" TEXT,
    "cep_id" TEXT,
    "landing_page_id" TEXT,
    "offer_variant_id" TEXT,
    "meta_ad_id" TEXT,
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "link_clicks" INTEGER NOT NULL DEFAULT 0,
    "landing_page_views" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION,
    "cpc" DOUBLE PRECISION,
    "cpl" DOUBLE PRECISION,
    "cplc" DOUBLE PRECISION,
    "cpm" DOUBLE PRECISION,
    "roas" DOUBLE PRECISION,
    "conv_rate" DOUBLE PRECISION,
    "cost_per_lpv" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'running',
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_test_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_variants" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offer_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ad_tests_user_id_idx" ON "ad_tests"("user_id");

-- CreateIndex
CREATE INDEX "ad_tests_status_idx" ON "ad_tests"("status");

-- CreateIndex
CREATE INDEX "ad_test_variants_ad_test_id_idx" ON "ad_test_variants"("ad_test_id");

-- CreateIndex
CREATE INDEX "offer_variants_product_id_idx" ON "offer_variants"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "generated_media_media_asset_id_key" ON "generated_media"("media_asset_id");

-- AddForeignKey
ALTER TABLE "generated_media" ADD CONSTRAINT "generated_media_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_tests" ADD CONSTRAINT "ad_tests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_tests" ADD CONSTRAINT "ad_tests_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_tests" ADD CONSTRAINT "ad_tests_campaign_session_id_fkey" FOREIGN KEY ("campaign_session_id") REFERENCES "campaign_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_tests" ADD CONSTRAINT "ad_tests_test_launch_id_fkey" FOREIGN KEY ("test_launch_id") REFERENCES "test_launches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_test_variants" ADD CONSTRAINT "ad_test_variants_ad_test_id_fkey" FOREIGN KEY ("ad_test_id") REFERENCES "ad_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_test_variants" ADD CONSTRAINT "ad_test_variants_generated_media_id_fkey" FOREIGN KEY ("generated_media_id") REFERENCES "generated_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_test_variants" ADD CONSTRAINT "ad_test_variants_test_launch_creative_id_fkey" FOREIGN KEY ("test_launch_creative_id") REFERENCES "test_launch_creatives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_test_variants" ADD CONSTRAINT "ad_test_variants_creative_variant_id_fkey" FOREIGN KEY ("creative_variant_id") REFERENCES "creative_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_test_variants" ADD CONSTRAINT "ad_test_variants_cep_id_fkey" FOREIGN KEY ("cep_id") REFERENCES "ceps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_test_variants" ADD CONSTRAINT "ad_test_variants_landing_page_id_fkey" FOREIGN KEY ("landing_page_id") REFERENCES "landing_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_test_variants" ADD CONSTRAINT "ad_test_variants_offer_variant_id_fkey" FOREIGN KEY ("offer_variant_id") REFERENCES "offer_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_variants" ADD CONSTRAINT "offer_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

