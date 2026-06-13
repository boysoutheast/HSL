# Blueprint: Conversation Thread — Worker ↔ SaaS LLM ↔ User

**Owner:** Boy Tenggara · Status: DRAFT
**Tujuan:** Tiap worker event direspon SaaS LLM (DeepSeek). Satu thread, banyak peserta. Hermes Utama = eskalasi.

---

## 1. Prinsip
- HSL/worker = deterministik. SaaS LLM = driver state machine di hot path. Hermes Utama = eskalasi doang.
- Worker event → DeepSeek putusin: NARRATE / ASK_USER / AUTO_CONTINUE / ESCALATE.
- Guardrail: idempoten + terminal + budget cap (cegah loop boncos).

---

## 2. DB Schema

Migration: `prisma/migrations/20260614100000_conversation_threads/migration.sql`
(IF NOT EXISTS semua, no DEFAULT cuid(), camelCase @map snake_case)

```sql
CREATE TABLE IF NOT EXISTS conversation_threads (
  id              TEXT PRIMARY KEY,
  subject_type    TEXT NOT NULL,           -- 'generated_media' | 'test_launch' | 'rule'
  subject_id      TEXT,
  status          TEXT NOT NULL DEFAULT 'open',  -- open | waiting_user | closed
  auto_continue_count INTEGER NOT NULL DEFAULT 0,
  max_auto_continue   INTEGER NOT NULL DEFAULT 5,
  telegram_chat_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS thread_messages (
  id          TEXT PRIMARY KEY,
  thread_id   TEXT NOT NULL REFERENCES conversation_threads(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,               -- 'worker' | 'saas_llm' | 'user' | 'hermes'
  kind        TEXT NOT NULL DEFAULT 'text',-- 'event' | 'text' | 'decision'
  content     TEXT NOT NULL,
  metadata_json TEXT,
  event_id    TEXT UNIQUE,                 -- idempotency utk worker events
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_thread_messages_thread ON thread_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_threads_status ON conversation_threads(status);
```

Prisma model: `ConversationThread` + `ThreadMessage` (camelCase + @map, relasi balik dua arah).

---

## 3. Endpoints

### `POST /api/internal/worker/events`
Worker lapor tiap task selesai/gagal/butuh input. Auth: WORKER_API_KEY (validateApiKey).
```
Body: { eventId, subjectType, subjectId, status, summary, dataJson? }
Flow:
  1. Cek event_id udah ada → 200 skip (idempoten)
  2. Upsert thread by (subjectType, subjectId)
  3. Insert thread_messages role=worker kind=event
  4. Panggil runSaasResponder(threadId)  ← step 4
  5. Return 200 { threadId }
```

### `POST /api/webhooks/telegram`
Terima reply user dari Telegram. Bypass admin middleware (whitelist /api/webhooks/*).
```
Flow: map chat_id → thread (status=waiting_user terbaru)
  → insert thread_messages role=user
  → set thread.status=open → runSaasResponder(threadId)
```

### `GET /api/admin/threads/:id`
View thread untuk UI (semua messages urut created_at).

---

## 4. SaaS Responder (`src/lib/saas-responder.ts`)

```
async function runSaasResponder(threadId):
  1. Load thread + last N messages (konteks)
  2. Kalau auto_continue_count >= max_auto_continue:
        force decision = ASK_USER (cegah loop)
  3. DeepSeek (src/lib/llm.ts) — system prompt minta output JSON:
        { decision: NARRATE|ASK_USER|AUTO_CONTINUE|ESCALATE,
          message: string,
          nextTask?: { type, payload } }
  4. Insert thread_messages role=saas_llm content=message
  5. Switch decision:
       NARRATE      → thread.status=closed
       ASK_USER     → status=waiting_user → kirim Telegram
       AUTO_CONTINUE→ create worker_task(nextTask) → auto_continue_count++
       ESCALATE     → status=waiting_user, insert role=hermes placeholder
                      → notif Hermes Utama (Telegram tag)
  6. Kirim message ke telegram_chat_id (kalau ada)
```

DeepSeek only — JANGAN provider lain. Output WAJIB JSON valid (retry 1x kalau parse gagal).

---

## 5. Telegram Helper (`src/lib/telegram.ts`)
```
sendTelegram(chatId, text): POST api.telegram.org/bot${TOKEN}/sendMessage
  parse_mode=Markdown, .catch(()=>{}) jangan crash.
```
Token via env TELEGRAM_BOT_TOKEN (worker yg punya bot — HSL pakai token sama buat reply).

---

## 6. Env Vars (.env.example HSL)
```
TELEGRAM_BOT_TOKEN=          # dari @BotFather (worker bot)
TELEGRAM_HERMES_CHAT_ID=     # chat eskalasi Hermes Utama
DEEPSEEK_API_KEY=            # udah ada
```

---

## 7. Worker side (boysoutheast/hermes-worker)
Ganti notif Telegram langsung → POST /api/internal/worker/events.
Worker NGGAK kirim Telegram sendiri lagi; SaaS responder yang atur reply.
Payload event: eventId (uuid), subjectType, subjectId, status, summary.

---

## 8. Acceptance
- T1: POST events 2x eventId sama → diproses sekali
- T2: event completed → thread_messages role=saas_llm muncul, decision NARRATE → closed
- T3: auto_continue_count capai max → dipaksa ASK_USER, nggak bikin task lagi
- T4: Telegram reply user → thread lanjut, status open
- T5: ESCALATE → notif TELEGRAM_HERMES_CHAT_ID, status waiting_user
- T6: tsc --noEmit 0 error

---

## 9. Eksekusi Order
1. Migration + Prisma model
2. src/lib/telegram.ts
3. src/lib/saas-responder.ts (DeepSeek)
4. POST /api/internal/worker/events
5. POST /api/webhooks/telegram + middleware whitelist
6. GET /api/admin/threads/:id
7. Worker repo: ganti notif → events endpoint (TERPISAH)

DILARANG force-push ke main. Deviation → prefix "DEVIATION:".
```
