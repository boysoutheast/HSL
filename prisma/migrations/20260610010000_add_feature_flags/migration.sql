-- CreateFeatureFlag
CREATE TABLE IF NOT EXISTS "feature_flags" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "key" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "target_id" TEXT,
    "config" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "feature_flags_enabled_scope_idx" ON "feature_flags"("enabled", "scope");
CREATE INDEX IF NOT EXISTS "feature_flags_scope_target_id_idx" ON "feature_flags"("scope", "target_id");
