-- Add Platform Foundation: 15 new models for Meta Ads automation platform
-- Migration: 20260609180000_add_platform_foundation

-- 1. MediaAsset: Stores uploaded or AI-generated media assets
CREATE TABLE IF NOT EXISTS "media_assets" (
    "id" VARCHAR(25) PRIMARY KEY,
    "user_id" VARCHAR(25) NOT NULL,
    "product_id" VARCHAR(25),
    "type" VARCHAR(20) NOT NULL,
    "source" VARCHAR(30) NOT NULL,
    "storage_provider" VARCHAR(50) NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "public_url" VARCHAR(1000),
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "checksum" VARCHAR(100) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',
    "moderation_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "generation_prompt" TEXT,
    "generated_by_model" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMP(3),
    CONSTRAINT "media_assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE,
    CONSTRAINT "media_assets_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL
);

-- 2. CreativeVariant: Ad creative combinations of media + copy
CREATE TABLE IF NOT EXISTS "creative_variants" (
    "id" VARCHAR(25) PRIMARY KEY,
    "user_id" VARCHAR(25) NOT NULL,
    "product_id" VARCHAR(25) NOT NULL,
    "media_asset_id" VARCHAR(25) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "primary_text" VARCHAR(125) NOT NULL,
    "headline" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "link_url" VARCHAR(1000) NOT NULL,
    "cta_button" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "quality_score" DOUBLE PRECISION,
    "created_from_cep_id" VARCHAR(25),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "creative_variants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE,
    CONSTRAINT "creative_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE,
    CONSTRAINT "creative_variants_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE
);

-- 3. MetaMediaBinding: Binds media assets to Meta ad accounts after upload
CREATE TABLE IF NOT EXISTS "meta_media_bindings" (
    "id" VARCHAR(25) PRIMARY KEY,
    "user_id" VARCHAR(25) NOT NULL,
    "media_asset_id" VARCHAR(25) NOT NULL,
    "meta_ad_account_id" VARCHAR(25) NOT NULL,
    "meta_image_hash" VARCHAR(100),
    "meta_video_id" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "last_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meta_media_bindings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE,
    CONSTRAINT "meta_media_bindings_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE,
    CONSTRAINT "meta_media_bindings_meta_ad_account_id_fkey" FOREIGN KEY ("meta_ad_account_id") REFERENCES "meta_ad_accounts"("id") ON DELETE CASCADE,
    CONSTRAINT "meta_media_bindings_media_asset_id_meta_ad_account_id_unique" UNIQUE ("media_asset_id", "meta_ad_account_id")
);

-- 4. CampaignSession: Represents an active ad campaign with automation
CREATE TABLE IF NOT EXISTS "campaign_sessions" (
    "id" VARCHAR(25) PRIMARY KEY,
    "user_id" VARCHAR(25) NOT NULL,
    "test_launch_id" VARCHAR(25),
    "product_id" VARCHAR(25) NOT NULL,
    "meta_ad_account_id" VARCHAR(25),
    "name" VARCHAR(200) NOT NULL,
    "objective" VARCHAR(30) NOT NULL DEFAULT 'OUTCOME_LEADS',
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "phase" VARCHAR(20) NOT NULL DEFAULT 'TESTING',
    "automation_enabled" BOOLEAN NOT NULL DEFAULT true,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Jakarta',
    "currency" VARCHAR(10) NOT NULL DEFAULT 'IDR',
    "daily_budget" DECIMAL(12, 2) NOT NULL,
    "monitor_interval_minutes" INTEGER NOT NULL DEFAULT 15,
    "next_monitor_at" TIMESTAMP(3),
    "last_monitor_at" TIMESTAMP(3),
    "last_action_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "campaign_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE,
    CONSTRAINT "campaign_sessions_test_launch_id_fkey" FOREIGN KEY ("test_launch_id") REFERENCES "test_launches"("id") ON DELETE SET NULL,
    CONSTRAINT "campaign_sessions_meta_ad_account_id_fkey" FOREIGN KEY ("meta_ad_account_id") REFERENCES "meta_ad_accounts"("id") ON DELETE SET NULL
);

-- 5. MetaEntity: Tracks Meta API entities (campaigns, adsets, ads, creatives)
CREATE TABLE IF NOT EXISTS "meta_entities" (
    "id" VARCHAR(25) PRIMARY KEY,
    "user_id" VARCHAR(25) NOT NULL,
    "campaign_session_id" VARCHAR(25) NOT NULL,
    "meta_ad_account_id" VARCHAR(25) NOT NULL,
    "entity_type" VARCHAR(20) NOT NULL,
    "meta_entity_id" VARCHAR(100) NOT NULL,
    "parent_meta_entity_id" VARCHAR(100),
    "name" VARCHAR(200) NOT NULL,
    "configured_status" VARCHAR(30),
    "effective_status" VARCHAR(30),
    "delivery_status" VARCHAR(30),
    "raw_state_json" TEXT,
    "last_synced_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meta_entities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE,
    CONSTRAINT "meta_entities_campaign_session_id_fkey" FOREIGN KEY ("campaign_session_id") REFERENCES "campaign_sessions"("id") ON DELETE CASCADE,
    CONSTRAINT "meta_entities_meta_ad_account_id_fkey" FOREIGN KEY ("meta_ad_account_id") REFERENCES "meta_ad_accounts"("id") ON DELETE CASCADE,
    CONSTRAINT "meta_entities_meta_ad_account_id_entity_type_meta_entity_id_unique" UNIQUE ("meta_ad_account_id", "entity_type", "meta_entity_id")
);

-- 6. CampaignCreativeLink: Links creative variants to campaign ad entities
CREATE TABLE IF NOT EXISTS "campaign_creative_links" (
    "id" VARCHAR(25) PRIMARY KEY,
    "campaign_session_id" VARCHAR(25) NOT NULL,
    "creative_variant_id" VARCHAR(25) NOT NULL,
    "meta_ad_entity_id" VARCHAR(25) NOT NULL,
    "rotation_sequence" INTEGER NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'INITIAL',
    "activated_at" TIMESTAMP(3),
    "retired_at" TIMESTAMP(3),
    "retire_reason" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "campaign_creative_links_campaign_session_id_fkey" FOREIGN KEY ("campaign_session_id") REFERENCES "campaign_sessions"("id") ON DELETE CASCADE,
    CONSTRAINT "campaign_creative_links_creative_variant_id_fkey" FOREIGN KEY ("creative_variant_id") REFERENCES "creative_variants"("id") ON DELETE CASCADE,
    CONSTRAINT "campaign_creative_links_meta_ad_entity_id_fkey" FOREIGN KEY ("meta_ad_entity_id") REFERENCES "meta_entities"("id") ON DELETE CASCADE
);

-- 7. MetricSnapshot: Periodic metric snapshots for campaign entities
CREATE TABLE IF NOT EXISTS "metric_snapshots" (
    "id" VARCHAR(25) PRIMARY KEY,
    "user_id" VARCHAR(25) NOT NULL,
    "campaign_session_id" VARCHAR(25) NOT NULL,
    "meta_entity_id" VARCHAR(25) NOT NULL,
    "entity_type" VARCHAR(20) NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "attribution_window" VARCHAR(30) NOT NULL,
    "spend" DOUBLE PRECISION NOT NULL,
    "impressions" INTEGER NOT NULL,
    "reach" INTEGER,
    "clicks" INTEGER NOT NULL,
    "link_clicks" INTEGER,
    "cpc" DOUBLE PRECISION,
    "ctr" DOUBLE PRECISION,
    "cpm" DOUBLE PRECISION,
    "leads" INTEGER,
    "purchases" INTEGER,
    "purchase_value" DOUBLE PRECISION,
    "roas" DOUBLE PRECISION,
    "frequency" DOUBLE PRECISION,
    "raw_metrics_json" TEXT,
    "data_freshness_seconds" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "metric_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE,
    CONSTRAINT "metric_snapshots_campaign_session_id_fkey" FOREIGN KEY ("campaign_session_id") REFERENCES "campaign_sessions"("id") ON DELETE CASCADE,
    CONSTRAINT "metric_snapshots_meta_entity_id_fkey" FOREIGN KEY ("meta_entity_id") REFERENCES "meta_entities"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "metric_snapshots_meta_entity_id_window_end_idx" ON "metric_snapshots"("meta_entity_id", "window_end");
CREATE INDEX IF NOT EXISTS "metric_snapshots_campaign_session_id_window_end_idx" ON "metric_snapshots"("campaign_session_id", "window_end");

-- 8. AutomationRule: Defines automation rules for campaign management
CREATE TABLE IF NOT EXISTS "automation_rules" (
    "id" VARCHAR(25) PRIMARY KEY,
    "user_id" VARCHAR(25) NOT NULL,
    "campaign_session_id" VARCHAR(25),
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "scope" VARCHAR(20) NOT NULL,
    "rule_category" VARCHAR(30) NOT NULL,
    "condition_tree_json" TEXT NOT NULL,
    "action_spec_json" TEXT NOT NULL,
    "evaluation_window_minutes" INTEGER,
    "minimum_data_age_minutes" INTEGER,
    "cooldown_minutes" INTEGER NOT NULL DEFAULT 60,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Jakarta',
    "max_fire_count" INTEGER,
    "last_fired_at" TIMESTAMP(3),
    "fire_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "automation_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE,
    CONSTRAINT "automation_rules_campaign_session_id_fkey" FOREIGN KEY ("campaign_session_id") REFERENCES "campaign_sessions"("id") ON DELETE SET NULL
);

-- 9. RuleExecution: Records each evaluation of an automation rule
CREATE TABLE IF NOT EXISTS "rule_executions" (
    "id" VARCHAR(25) PRIMARY KEY,
    "rule_id" VARCHAR(25) NOT NULL,
    "rule_version" INTEGER NOT NULL,
    "campaign_session_id" VARCHAR(25) NOT NULL,
    "target_meta_entity_id" VARCHAR(25),
    "evaluated_at" TIMESTAMP(3) NOT NULL,
    "matched" BOOLEAN NOT NULL,
    "condition_result_json" TEXT NOT NULL,
    "metric_references_json" TEXT,
    "reason_text" VARCHAR(500),
    "action_created_id" VARCHAR(25),
    "deduplication_key" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rule_executions_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "automation_rules"("id") ON DELETE CASCADE,
    CONSTRAINT "rule_executions_campaign_session_id_fkey" FOREIGN KEY ("campaign_session_id") REFERENCES "campaign_sessions"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "rule_executions_rule_id_campaign_session_id_idx" ON "rule_executions"("rule_id", "campaign_session_id");

-- 10. AutomationAction: Actions triggered by automation rules or manually
CREATE TABLE IF NOT EXISTS "automation_actions" (
    "id" VARCHAR(25) PRIMARY KEY,
    "user_id" VARCHAR(25) NOT NULL,
    "campaign_session_id" VARCHAR(25) NOT NULL,
    "rule_execution_id" VARCHAR(25),
    "source" VARCHAR(20) NOT NULL,
    "action_type" VARCHAR(50) NOT NULL,
    "target_entity_type" VARCHAR(20),
    "target_meta_entity_id" VARCHAR(25),
    "payload_json" TEXT NOT NULL,
    "precondition_json" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "idempotency_key" VARCHAR(200) NOT NULL,
    "priority" INTEGER NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL,
    "executed_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "error_code" VARCHAR(50),
    "error_message" TEXT,
    "meta_response_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "automation_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE,
    CONSTRAINT "automation_actions_campaign_session_id_fkey" FOREIGN KEY ("campaign_session_id") REFERENCES "campaign_sessions"("id") ON DELETE CASCADE,
    CONSTRAINT "automation_actions_rule_execution_id_fkey" FOREIGN KEY ("rule_execution_id") REFERENCES "rule_executions"("id") ON DELETE SET NULL,
    CONSTRAINT "automation_actions_idempotency_key_unique" UNIQUE ("idempotency_key")
);

-- 11. CreativeReservation: Reserves creative variants for ad rotation
CREATE TABLE IF NOT EXISTS "creative_reservations" (
    "id" VARCHAR(25) PRIMARY KEY,
    "creative_variant_id" VARCHAR(25) NOT NULL,
    "campaign_session_id" VARCHAR(25) NOT NULL,
    "automation_action_id" VARCHAR(25) NOT NULL,
    "reserved_by_worker_id" VARCHAR(50),
    "status" VARCHAR(20) NOT NULL DEFAULT 'RESERVED',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "creative_reservations_creative_variant_id_fkey" FOREIGN KEY ("creative_variant_id") REFERENCES "creative_variants"("id") ON DELETE CASCADE,
    CONSTRAINT "creative_reservations_campaign_session_id_fkey" FOREIGN KEY ("campaign_session_id") REFERENCES "campaign_sessions"("id") ON DELETE CASCADE,
    CONSTRAINT "creative_reservations_automation_action_id_fkey" FOREIGN KEY ("automation_action_id") REFERENCES "automation_actions"("id") ON DELETE CASCADE
);

-- 12. CreativeRotation: Tracks creative replacement rotations
CREATE TABLE IF NOT EXISTS "creative_rotations" (
    "id" VARCHAR(25) PRIMARY KEY,
    "campaign_session_id" VARCHAR(25) NOT NULL,
    "automation_action_id" VARCHAR(25) NOT NULL,
    "old_meta_ad_id" VARCHAR(100),
    "new_meta_ad_id" VARCHAR(100),
    "old_creative_variant_id" VARCHAR(25),
    "new_creative_variant_id" VARCHAR(25) NOT NULL,
    "strategy" VARCHAR(20) NOT NULL,
    "trigger_reason" VARCHAR(200),
    "started_at" TIMESTAMP(3) NOT NULL,
    "activated_at" TIMESTAMP(3),
    "old_ad_paused_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "creative_rotations_campaign_session_id_fkey" FOREIGN KEY ("campaign_session_id") REFERENCES "campaign_sessions"("id") ON DELETE CASCADE,
    CONSTRAINT "creative_rotations_automation_action_id_fkey" FOREIGN KEY ("automation_action_id") REFERENCES "automation_actions"("id") ON DELETE CASCADE,
    CONSTRAINT "creative_rotations_old_creative_variant_id_fkey" FOREIGN KEY ("old_creative_variant_id") REFERENCES "creative_variants"("id") ON DELETE SET NULL,
    CONSTRAINT "creative_rotations_new_creative_variant_id_fkey" FOREIGN KEY ("new_creative_variant_id") REFERENCES "creative_variants"("id") ON DELETE SET NULL
);

-- 13. WorkerRegistry: Tracks registered worker instances
CREATE TABLE IF NOT EXISTS "worker_registry" (
    "id" VARCHAR(25) PRIMARY KEY,
    "worker_id" VARCHAR(50) NOT NULL UNIQUE,
    "mode" VARCHAR(30) NOT NULL,
    "instance_id" VARCHAR(100),
    "version" VARCHAR(50),
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMP(3) NOT NULL,
    "last_heartbeat_at" TIMESTAMP(3) NOT NULL,
    "active_task_count" INTEGER NOT NULL DEFAULT 0,
    "max_concurrency" INTEGER NOT NULL DEFAULT 5,
    "metadata_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 14. WorkerLease: Distributed leases for work coordination
CREATE TABLE IF NOT EXISTS "worker_leases" (
    "id" VARCHAR(25) PRIMARY KEY,
    "lease_type" VARCHAR(50) NOT NULL,
    "owner_worker_id" VARCHAR(50) NOT NULL,
    "user_id" VARCHAR(25),
    "meta_ad_account_id" VARCHAR(25),
    "partition_key" VARCHAR(200) NOT NULL,
    "lease_expires_at" TIMESTAMP(3) NOT NULL,
    "heartbeat_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "worker_leases_owner_worker_id_fkey" FOREIGN KEY ("owner_worker_id") REFERENCES "worker_registry"("worker_id") ON DELETE CASCADE,
    CONSTRAINT "worker_leases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL,
    CONSTRAINT "worker_leases_meta_ad_account_id_fkey" FOREIGN KEY ("meta_ad_account_id") REFERENCES "meta_ad_accounts"("id") ON DELETE SET NULL
);

-- 15. WorkerHeartbeatEvent: Heartbeat event log for worker health tracking
CREATE TABLE IF NOT EXISTS "worker_heartbeat_events" (
    "id" VARCHAR(25) PRIMARY KEY,
    "worker_id" VARCHAR(50) NOT NULL,
    "severity" VARCHAR(20) NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "message" TEXT NOT NULL,
    "metadata_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "worker_heartbeat_events_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "worker_registry"("worker_id") ON DELETE CASCADE
);
