# Blueprint: Agent Isolation + Worker vs User Agent Architecture

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION
**Estimasi:** 20–30 menit nonstop (Sonnet)
**Prioritas:** PHASE A wajib selesai sebelum terima agent luar

---

## Konteks

HSL punya 3 kategori caller:

| Caller | Auth | Endpoint | Kerjaan |
|---|---|---|---|
| **Worker agent** (internal) | `x-api-key` (HermesAgent.is_worker=true) | `/api/worker/*` | Eksekusi task: video gen, meta campaign, rehost |
| **Content agent** (internal) | Bearer (HermesAgent) | `/api/hermes/*` | Konten IG: library, CEP, content log |
| **User agent** (self-serve) | `x-api-key` (UserApiKey) | `/api/gen/*` | Generate video sendiri, lihat hasil sendiri |

**Gap keamanan saat ini:**
- `GET /api/worker/tasks` — gak ada filter per agent. Semua worker lihat semua task.
- `POST /api/hermes/tasks` (claim) — gak ada filter per agent. Worker A bisa claim task Worker B.
- `GET /api/hermes/tasks` — filter by `capability='content_generation'` tapi bukan per agent.
- WorkerTask schema: tidak ada `createdByUserId` / `assignedAgentId`.

---

## PHASE A: Task Queue Isolation (WAJIB, security patch)

### A1. Migration

File: `prisma/migrations/20260614200000_worker_task_isolation/migration.sql`

```sql
-- Tambah kolom scope + owner ke worker_tasks
ALTER TABLE worker_tasks
  ADD COLUMN IF NOT EXISTS owner_user_id   TEXT,
  ADD COLUMN IF NOT EXISTS scope           TEXT NOT NULL DEFAULT 'internal';
  -- scope: 'internal' (worker pool bersama) | 'user' (dimiliki user tertentu)

-- Index untuk query isolasi
CREATE INDEX IF NOT EXISTS idx_worker_tasks_scope       ON worker_tasks(scope, status);
CREATE INDEX IF NOT EXISTS idx_worker_tasks_owner_user  ON worker_tasks(owner_user_id);
```

**Prisma schema** — tambah ke model `WorkerTask`:
```prisma
ownerUserId  String?  @map("owner_user_id")  // null = internal/system task
scope        String   @default("internal")    // 'internal' | 'user'

@@index([scope, status])
@@index([ownerUserId])
```

### A2. Fix `/api/worker/tasks` GET — filter scope internal

File: `src/app/api/worker/tasks/route.ts`

```ts
// Di WHERE clause, tambah filter scope
const where: Record<string, unknown> = {
  scope: 'internal',  // worker hanya lihat task internal pool
}
```

Worker pool = tasks yang dibuat sistem (launch campaign, rehost, dll). Bukan milik user tertentu.

### A3. Fix `/api/hermes/tasks` GET + POST — filter per agent capability

File: `src/app/api/hermes/tasks/route.ts`

GET — sudah filter `capability='content_generation'` tapi tambah scope:
```ts
where: {
  status: 'pending',
  type: { in: types },
  scope: 'internal',  // content agent juga hanya lihat internal
}
```

POST (claim) — saat ini klaim langsung. Tambah guard: task yang lagi `processing` tidak bisa di-claim ulang:
```ts
// Sebelum update, pastikan task masih pending
const task = await prisma.workerTask.findFirst({
  where: { id: taskId, status: 'pending', scope: 'internal' }
})
if (!task) return NextResponse.json({ error: 'Task not available' }, { status: 409 })

// Atomic claim dengan conditional update
const claimed = await prisma.workerTask.updateMany({
  where: { id: taskId, status: 'pending' },
  data: { status: 'processing', startedAt: new Date() },
})
if (claimed.count === 0) return NextResponse.json({ error: 'Task already claimed' }, { status: 409 })
```

### A4. Set scope='user' saat create task dari /api/gen/*

File: `src/app/api/gen/video/route.ts` — saat create WorkerTask untuk video gen:
```ts
await prisma.workerTask.create({
  data: {
    ...taskData,
    scope: 'user',
    ownerUserId: user.id,  // user dari requireApiKey()
  }
})
```

---

## PHASE B: User Agent Task Visibility

User agent (UserApiKey) harus bisa lihat dan poll status task milik mereka sendiri.

### B1. Endpoint baru: GET /api/gen/tasks

File: `src/app/api/gen/tasks/route.ts`

```ts
// Auth via requireApiKey
// Return: tasks WHERE scope='user' AND ownerUserId=user.id
// Query params: ?status=pending|processing|completed|failed&limit=20&offset=0
```

Ini berbeda dari `/api/gen/video` (yang spesifik video). `/api/gen/tasks` = semua task milik user.

### B2. Endpoint: GET /api/gen/tasks/[id]

File: `src/app/api/gen/tasks/[id]/route.ts`

```ts
// Auth via requireApiKey
// Return task jika ownerUserId === user.id, else 404
// Include resultJson parsed
```

---

## PHASE C: Worker Task Create (internal system) — scope hardcoded

Semua tempat HSL buat WorkerTask untuk operasi internal (bukan dari user):

Cari dengan: `grep -r "workerTask.create\|WorkerTask.create" src/`

Setiap create internal → tambah `scope: 'internal'` (default sudah 'internal' via migration, tapi eksplisit lebih aman).

---

## Acceptance Criteria

- [ ] Worker A tidak bisa lihat/claim task yang dibuat Worker B atau user
- [ ] User X tidak bisa lihat task User Y via /api/gen/tasks
- [ ] Task internal (launch campaign, dll) tidak muncul di /api/gen/tasks user manapun
- [ ] Worker masih bisa claim semua task `scope='internal'`
- [ ] User bisa poll task status via GET /api/gen/tasks/[id]
- [ ] tsc --noEmit 0 error (system page)
- [ ] Migrasi IF NOT EXISTS, no DEFAULT cuid(), semua camelCase punya @map

---

## Execution Order

```
1. Migration SQL + prisma schema (scope + ownerUserId)
2. npx prisma generate
3. A2: fix /api/worker/tasks WHERE scope='internal'
4. A3: fix /api/hermes/tasks GET + POST claim guard
5. A4: set scope='user' + ownerUserId di /api/gen/video route
6. B1: GET /api/gen/tasks
7. B2: GET /api/gen/tasks/[id]
8. C: audit semua internal WorkerTask.create → tambah scope:'internal' eksplisit
9. tsc --noEmit → fix semua error
10. git add -p → commit tiap phase → push
11. Railway deploy → smoke test
```

---

## Smoke Test setelah deploy

```bash
# 1. Internal task tidak bocor ke user
curl -H "x-api-key: <user_api_key>" https://ai.boytenggara.com/api/gen/tasks
# Harusnya: [] (task internal tidak muncul)

# 2. User hanya lihat task sendiri
curl -H "x-api-key: <user_A_key>" https://ai.boytenggara.com/api/gen/tasks
# Harusnya: hanya task milik user A

# 3. Worker masih bisa lihat internal tasks
curl -H "x-api-key: <worker_key>" https://ai.boytenggara.com/api/worker/tasks
# Harusnya: tasks scope='internal' saja

# 4. Claim idempotency
# POST claim task yang sama 2x → second harusnya 409
```

---

## Aturan wajib (carry over)

- Semua LLM via `src/lib/llm.ts` (DeepSeek). Jangan provider lain.
- Migration: IF NOT EXISTS semua, NO DEFAULT cuid(), camelCase wajib @map("snake_case")
- Token/secret JANGAN ke log/response/commit/memory
- Worker task status: **lowercase** pending/processing/completed/failed
- No force-push ke main. Deviation → prefix "DEVIATION:"
- Satu commit per phase, message jelas
- JANGAN claim done tanpa verify (tsc clean + smoke test)
