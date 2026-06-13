-- B1: Credit & Billing Schema
-- Additive migration — NO destructive changes

-- 1. HermesAgent: add ownerUserId + creditBalance
ALTER TABLE "hermes_agents" 
  ADD COLUMN "owner_user_id" TEXT,
  ADD COLUMN "credit_balance" INTEGER NOT NULL DEFAULT 0;

-- FK for hermes_agents.owner_user_id → admin_users.id
ALTER TABLE "hermes_agents" 
  ADD CONSTRAINT "hermes_agents_owner_user_id_fkey" 
  FOREIGN KEY ("owner_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. GeneratedMedia: add userId, mediaType, creditsCost, refundedAt
ALTER TABLE "generated_media" 
  ADD COLUMN "user_id" TEXT,
  ADD COLUMN "media_type" TEXT NOT NULL DEFAULT 'VIDEO',
  ADD COLUMN "credits_cost" INTEGER,
  ADD COLUMN "refunded_at" TIMESTAMPTZ;

-- FK for generated_media.user_id → admin_users.id
ALTER TABLE "generated_media" 
  ADD CONSTRAINT "generated_media_user_id_fkey" 
  FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. CreditTransaction table
CREATE TABLE "credit_transactions" (
  "id"              TEXT NOT NULL,
  "user_id"         TEXT NOT NULL,
  "amount"          INTEGER NOT NULL,
  "reason"          TEXT NOT NULL,
  "ref_id"          TEXT,
  "ref_type"        TEXT,
  "balance_after"   INTEGER NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "credit_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "credit_transactions_idempotency_key_key" ON "credit_transactions"("idempotency_key");
CREATE INDEX "credit_transactions_user_id_created_at_idx" ON "credit_transactions"("user_id", "created_at");
