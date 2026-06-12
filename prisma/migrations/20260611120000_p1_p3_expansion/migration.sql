-- P1-P3 Expansion: LandingPageStat, MediaLibraryRule, WorkerTaskResult, RuleTemplate,
-- MetaAudience, MetaCatalog, MetaProductSet, CapiEventConfig

-- LandingPageStat
CREATE TABLE IF NOT EXISTS "landing_page_stats" (
    "id" TEXT NOT NULL,
    "landing_page_id" TEXT NOT NULL,
    "source" TEXT,
    "source_ref_id" TEXT,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversion_rate" DOUBLE PRECISION,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "landing_page_stats_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "landing_page_stats_landing_page_id_date_idx" ON "landing_page_stats"("landing_page_id", "date");
ALTER TABLE "landing_page_stats" ADD CONSTRAINT "landing_page_stats_landing_page_id_fkey"
    FOREIGN KEY ("landing_page_id") REFERENCES "landing_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MediaLibraryRule
CREATE TABLE IF NOT EXISTS "media_library_rules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger_type" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "product_id" TEXT,
    "character_id" TEXT,
    "media_type" TEXT NOT NULL DEFAULT 'VIDEO',
    "action_type" TEXT NOT NULL DEFAULT 'CREATE_TASK',
    "task_type" TEXT,
    "task_payload_json" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "cooldown_hours" INTEGER NOT NULL DEFAULT 24,
    "last_triggered_at" TIMESTAMP(3),
    "trigger_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "media_library_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "media_library_rules_status_idx" ON "media_library_rules"("status");
CREATE INDEX IF NOT EXISTS "media_library_rules_user_id_idx" ON "media_library_rules"("user_id");
ALTER TABLE "media_library_rules" ADD CONSTRAINT "media_library_rules_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_library_rules" ADD CONSTRAINT "media_library_rules_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_library_rules" ADD CONSTRAINT "media_library_rules_character_id_fkey"
    FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- WorkerTaskResult
CREATE TABLE IF NOT EXISTS "worker_task_results" (
    "id" TEXT NOT NULL,
    "worker_task_id" TEXT NOT NULL,
    "result_type" TEXT NOT NULL,
    "media_asset_id" TEXT,
    "content_log_id" TEXT,
    "data_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "worker_task_results_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "worker_task_results_worker_task_id_idx" ON "worker_task_results"("worker_task_id");
ALTER TABLE "worker_task_results" ADD CONSTRAINT "worker_task_results_worker_task_id_fkey"
    FOREIGN KEY ("worker_task_id") REFERENCES "worker_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "worker_task_results" ADD CONSTRAINT "worker_task_results_media_asset_id_fkey"
    FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RuleTemplate
CREATE TABLE IF NOT EXISTS "rule_templates" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" TEXT NOT NULL,
    "rule_category" TEXT NOT NULL,
    "condition_tree_json" TEXT NOT NULL,
    "action_spec_json" TEXT NOT NULL,
    "is_builtin" BOOLEAN NOT NULL DEFAULT false,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rule_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "rule_templates_user_id_idx" ON "rule_templates"("user_id");
ALTER TABLE "rule_templates" ADD CONSTRAINT "rule_templates_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MetaAudience
CREATE TABLE IF NOT EXISTS "meta_audiences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "meta_ad_account_id" TEXT NOT NULL,
    "meta_audience_id" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "description" TEXT,
    "source_audience_id" TEXT,
    "lookalike_ratio" DOUBLE PRECISION,
    "lookalike_country" TEXT,
    "rule_json" TEXT,
    "retention_days" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "size_lower_bound" INTEGER,
    "size_upper_bound" INTEGER,
    "error_message" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "meta_audiences_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "meta_audiences_user_id_idx" ON "meta_audiences"("user_id");
CREATE INDEX IF NOT EXISTS "meta_audiences_meta_ad_account_id_idx" ON "meta_audiences"("meta_ad_account_id");
ALTER TABLE "meta_audiences" ADD CONSTRAINT "meta_audiences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MetaCatalog
CREATE TABLE IF NOT EXISTS "meta_catalogs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "meta_business_id" TEXT,
    "meta_catalog_id" TEXT,
    "name" TEXT NOT NULL,
    "vertical" TEXT NOT NULL DEFAULT 'commerce',
    "product_count" INTEGER NOT NULL DEFAULT 0,
    "is_cpas" BOOLEAN NOT NULL DEFAULT false,
    "partner_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "error_message" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "meta_catalogs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "meta_catalogs_user_id_idx" ON "meta_catalogs"("user_id");
ALTER TABLE "meta_catalogs" ADD CONSTRAINT "meta_catalogs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- MetaProductSet
CREATE TABLE IF NOT EXISTS "meta_product_sets" (
    "id" TEXT NOT NULL,
    "catalog_id" TEXT NOT NULL,
    "meta_product_set_id" TEXT,
    "name" TEXT NOT NULL,
    "filter_json" TEXT,
    "product_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "meta_product_sets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "meta_product_sets_catalog_id_idx" ON "meta_product_sets"("catalog_id");
ALTER TABLE "meta_product_sets" ADD CONSTRAINT "meta_product_sets_catalog_id_fkey"
    FOREIGN KEY ("catalog_id") REFERENCES "meta_catalogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CapiEventConfig
CREATE TABLE IF NOT EXISTS "capi_event_configs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pixel_id" TEXT NOT NULL,
    "access_token_encrypted" TEXT NOT NULL,
    "test_event_code" TEXT,
    "allowed_events" TEXT[] NOT NULL DEFAULT ARRAY['PageView', 'ViewContent', 'AddToCart', 'Purchase', 'Lead']::TEXT[],
    "landing_page_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "event_count" INTEGER NOT NULL DEFAULT 0,
    "last_event_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "capi_event_configs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "capi_event_configs_user_id_idx" ON "capi_event_configs"("user_id");
CREATE INDEX IF NOT EXISTS "capi_event_configs_pixel_id_idx" ON "capi_event_configs"("pixel_id");
ALTER TABLE "capi_event_configs" ADD CONSTRAINT "capi_event_configs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
