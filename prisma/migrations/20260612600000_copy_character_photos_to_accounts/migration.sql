-- Link photo_references that belong to a character to the character's
-- parent instagram_account. Leaves character_id intact.
-- Only updates rows where instagram_account_id is currently NULL.
UPDATE photo_references pr
SET instagram_account_id = c.instagram_account_id
FROM characters c
WHERE pr.character_id = c.id
  AND pr.instagram_account_id IS NULL
  AND c.instagram_account_id IS NOT NULL;
