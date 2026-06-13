-- B1: Credit & Billing Schema (ADDITIVE ONLY)
-- NO generated_media changes — those are in 20260613110000_genmedia_credit_fields

-- 1. AdminUser: add credit_balance
ALTER TABLE "admin_users" 
  ADD COLUMN IF NOT EXISTS "credit_balance" INTEGER NOT NULL DEFAULT 0;

-- 2. HermesAgent: add ownerUserId + creditBalance
ALTER TABLE "hermes_agents" 
  ADD COLUMN IF NOT EXISTS "owner_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "credit_balance" INTEGER NOT NULL DEFAULT 0;

-- FK for hermes_agents.owner_user_id → admin_users.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hermes_agents_owner_user_id_fkey'
  ) THEN
    ALTER TABLE "hermes_agents" 
      ADD CONSTRAINT "hermes_agents_owner_user_id_fkey" 
      FOREIGN KEY ("owner_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. CreditTransaction table
CREATE TABLE IF NOT EXISTS "credit_transactions" (
  "id"              TEXT NOT NULL,
  "user_id"         TEXT NOT NULL,
  "amount"          INTEGER NOT NULL,
  "reason"          TEXT NOT NULL,
  "ref_id"          TEXT,
  "ref_type"        TEXT,
  "balance_after"   INTEGER NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- FK credit_transactions.user_id → admin_users.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'credit_transactions_user_id_fkey'
  ) THEN
    ALTER TABLE "credit_transactions" 
      ADD CONSTRAINT "credit_transactions_user_id_fkey" 
      FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "credit_transactions_idempotency_key_key" ON "credit_transactions"("idempotency_key");
CREATE INDEX IF NOT EXISTS "credit_transactions_user_id_created_at_idx" ON "credit_transactions"("user_id", "created_at");
