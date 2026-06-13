-- B2-v2: Move creditBalance from hermes_agents to admin_users
-- ADDITIVE ONLY — no destructive changes
-- Safe for prod re-run (all IF NOT EXISTS / IF EXISTS)

-- 1. Add credit_balance to admin_users if not already present
ALTER TABLE "admin_users" 
  ADD COLUMN IF NOT EXISTS "credit_balance" INTEGER DEFAULT 0;

-- 2. Migrate existing balances from hermes_agents to admin_users
-- Only copy if hermes_agents.credit_balance > 0 and owner_user_id is set
UPDATE "admin_users" u
  SET "credit_balance" = COALESCE(u."credit_balance", 0) + COALESCE(ha."credit_balance", 0)
  FROM "hermes_agents" ha
  WHERE ha."owner_user_id" = u."id" 
    AND ha."credit_balance" IS NOT NULL 
    AND ha."credit_balance" > 0
    AND NOT EXISTS (
      SELECT 1 FROM "admin_users" au2 WHERE au2."id" = u."id" AND au2."credit_balance" = COALESCE(u."credit_balance", 0) + COALESCE(ha."credit_balance", 0)
    );

-- 3. Drop credit_balance from hermes_agents (safe — IF EXISTS)
ALTER TABLE "hermes_agents" 
  DROP COLUMN IF EXISTS "credit_balance";
