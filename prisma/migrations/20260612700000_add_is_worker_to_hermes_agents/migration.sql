-- Separate worker agents from content agents.
-- Worker endpoints (/api/worker/*) will only accept agents with is_worker = true.
ALTER TABLE hermes_agents ADD COLUMN IF NOT EXISTS is_worker BOOLEAN NOT NULL DEFAULT false;

-- Mark the existing dedicated worker agent.
UPDATE hermes_agents SET is_worker = true WHERE name = 'Hermes Worker';
