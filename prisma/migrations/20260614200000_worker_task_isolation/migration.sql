-- Agent Isolation: add scope + owner_user_id to worker_tasks
-- scope: 'internal' (worker pool bersama) | 'user' (dimiliki user tertentu)

ALTER TABLE worker_tasks
  ADD COLUMN IF NOT EXISTS owner_user_id   TEXT,
  ADD COLUMN IF NOT EXISTS scope           TEXT NOT NULL DEFAULT 'internal';

CREATE INDEX IF NOT EXISTS idx_worker_tasks_scope       ON worker_tasks(scope, status);
CREATE INDEX IF NOT EXISTS idx_worker_tasks_owner_user  ON worker_tasks(owner_user_id);
