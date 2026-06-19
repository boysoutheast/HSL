-- Add budgetMode to campaign_sessions: CBO (campaign-level budget) or ABO (adset-level budget)
ALTER TABLE campaign_sessions ADD COLUMN IF NOT EXISTS budget_mode VARCHAR(10) DEFAULT NULL;

-- Add primary_adset_meta_id for ABO budget targeting  
ALTER TABLE campaign_sessions ADD COLUMN IF NOT EXISTS primary_adset_meta_id VARCHAR(50) DEFAULT NULL;
