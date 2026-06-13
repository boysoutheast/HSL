-- CreateTable
CREATE TABLE IF NOT EXISTS "conversation_threads" (
  "id" TEXT NOT NULL,
  "subject_type" TEXT NOT NULL,
  "subject_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "auto_continue_count" INTEGER NOT NULL DEFAULT 0,
  "max_auto_continue" INTEGER NOT NULL DEFAULT 5,
  "telegram_chat_id" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "conversation_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "thread_messages" (
  "id" TEXT NOT NULL,
  "thread_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'text',
  "content" TEXT NOT NULL,
  "metadata_json" TEXT,
  "event_id" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "thread_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_thread_messages_thread" ON "thread_messages"("thread_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_threads_status" ON "conversation_threads"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "idx_thread_messages_event_id" ON "thread_messages"("event_id");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "thread_messages" ADD CONSTRAINT "thread_messages_thread_id_fkey"
    FOREIGN KEY ("thread_id") REFERENCES "conversation_threads"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
