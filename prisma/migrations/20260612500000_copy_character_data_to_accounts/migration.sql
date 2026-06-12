-- Copy persona data from characters → instagram_accounts.
-- Picks the most recently created active character per account.
-- Uses COALESCE so manually-filled account fields are never overwritten.
UPDATE instagram_accounts ia
SET
  character_description = COALESCE(ia.character_description, c.description),
  behavior              = COALESCE(ia.behavior, c.behavior),
  speaking_style        = COALESCE(ia.speaking_style, c.speaking_style),
  expression_style      = COALESCE(ia.expression_style, c.expression_style),
  movement_style        = COALESCE(ia.movement_style, c.movement_style),
  forbidden_rules       = COALESCE(ia.forbidden_rules, c.forbidden_rules)
FROM (
  SELECT DISTINCT ON (instagram_account_id)
    instagram_account_id,
    description,
    behavior,
    speaking_style,
    expression_style,
    movement_style,
    forbidden_rules
  FROM characters
  WHERE status = 'active'
  ORDER BY instagram_account_id, created_at DESC
) c
WHERE c.instagram_account_id = ia.id;
