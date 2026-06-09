-- Migration: 20260609062000_add_worker_task_result_json
-- Adds result_json column used by WorkerTask.resultJson in Prisma schema.

ALTER TABLE "worker_tasks"
  ADD COLUMN IF NOT EXISTS "result_json" TEXT;

-- Keep existing pending/processing/completed tasks intact.
