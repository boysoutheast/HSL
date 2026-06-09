-- Migration: add_dead_letter_entries
-- Created: 2026-06-10

-- Create dead_letter_entries table
CREATE TABLE "dead_letter_entries" (
    "id" TEXT NOT NULL,
    "worker_task_id" TEXT NOT NULL,
    "action_id" TEXT,
    "task_type" TEXT NOT NULL,
    "payload_json" TEXT NOT NULL,
    "error_code" TEXT NOT NULL,
    "error_message" TEXT NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "assigned_to" TEXT,
    "resolution" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dead_letter_entries_pkey" PRIMARY KEY ("id")
);

-- Index for filtering by status + creation time (common query pattern)
CREATE INDEX "dead_letter_entries_status_created_at_idx" ON "dead_letter_entries"("status", "created_at");

-- Index for filtering by task type
CREATE INDEX "dead_letter_entries_task_type_idx" ON "dead_letter_entries"("task_type");
