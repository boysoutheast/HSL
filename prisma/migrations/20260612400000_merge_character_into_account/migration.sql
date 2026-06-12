ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS character_description TEXT;
ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS behavior TEXT;
ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS speaking_style TEXT;
ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS expression_style TEXT;
ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS movement_style TEXT;
ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS forbidden_rules TEXT;
