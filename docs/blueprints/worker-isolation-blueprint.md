# Blueprint: Worker Isolation Audit & Fix

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION
**Auditor:** Fable 5 (2026-06-15)
**Executor:** Sonnet
**Estimasi:** 10–15 menit

---

## Latar Belakang

Worker agent (Hermes worker, `isWorker=true`) dan content agent (Hermes utama, Digipro, `isWorker=false`) adalah dua entitas berbeda dengan akses yang seharusnya dipisah ketat:

| Aktor | Key type | Boleh akses |
|---|---|---|
| Worker agent | HermesAgent (`isWorker=true`) | `/api/worker/*` + task claim endpoint |
| Content agent | HermesAgent (`isWorker=false`) | `/api/hermes/*` untuk content ops |
| User | UserApiKey | `/api/gen/*` |

**Masalah ditemukan:** Endpoint `/api/hermes/tasks` (GET + POST) dan `/api/hermes/tasks/[id]` (POST) menggunakan `validateHermesApiKey` — yang menerima SEMUA HermesAgent tanpa cek `isWorker`. Akibatnya, content agent (Hermes utama, Digipro) bisa:
1. **Melihat seluruh antrian worker** — GET `/api/hermes/tasks` list semua pending internal tasks
2. **Claim task sebagai worker** — POST `/api/hermes/tasks` mengklaim task dan menulis `workerId`
3. **Complete/fail task** — POST `/api/hermes/tasks/[id]` setelah claim

Ini izin yang TIDAK BOLEH ada. Worker queue adalah alat internal, bukan sesuatu yang content agent perlu tahu.

---

## Audit Lengkap: Status Per Endpoint

### 🔴 VIOLATION — Harus difix

| Endpoint | Masalah | Fix |
|---|---|---|
| `GET /api/hermes/tasks` | Content agent bisa list seluruh pending worker tasks | `validateHermesApiKey` → `validateWorkerApiKey` |
| `POST /api/hermes/tasks` | Content agent bisa claim task (set workerId) | `validateHermesApiKey` → `validateWorkerApiKey` |
| `POST /api/hermes/tasks/[id]` | Content agent bisa complete/fail task yang sudah diclaim | `validateHermesApiKey` → `validateWorkerApiKey` |

### ✅ INTENTIONAL — Jangan diubah

| Endpoint | Kenapa boleh |
|---|---|
| `GET /api/hermes/cpas/slot-count` | Content agent (CPAS orchestrator) perlu hitung kapasitas slot. Hanya expose COUNT, bukan task detail. |
| `POST /api/hermes/cpas/spawn-job` | Content agent MEMBUAT task untuk worker — ini by design. CPAS flow: agent spawn → worker execute. |
| `GET /api/hermes/cpas/spawn-job/[id]` | Content agent poll status job yang dia spawn sendiri. |
| `PATCH /api/hermes/cpas/spawn-job/[id]` | Content agent update stage CPAS job (cpas_spawn_plan → cpas_image_submit → ...). |

### ⚠️ DEFERRED — Ownership gap (low severity)

| Endpoint | Gap | Keputusan |
|---|---|---|
| `PATCH /api/hermes/cpas/spawn-job/[id]` | Tidak ada ownership check — agent A bisa update job yang di-spawn agent B | DEFERRED: hanya 1 CPAS agent di prod, low risk. Bisa ditambahkan `spawnedBy` field di future. |

---

## Fix Detail

### Fix 1 — `src/app/api/hermes/tasks/route.ts`

**Sebelum (GET dan POST):**
```ts
const agent = await validateHermesApiKey(token)
if (!agent) return NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401 })
```

**Sesudah:**
```ts
import { validateWorkerApiKey, extractBearerToken } from '@/lib/auth'
// ...
const agent = await validateWorkerApiKey(token)
if (!agent) return NextResponse.json({ error: 'Unauthorized — worker key required' }, { status: 401 })
```

`validateWorkerApiKey` sudah ada di `src/lib/auth.ts` dan sudah cek `agent.isWorker === true`. Tinggal ganti import dan call.

### Fix 2 — `src/app/api/hermes/tasks/[id]/route.ts`

**Sebelum:**
```ts
import { validateHermesApiKey, extractBearerToken } from '@/lib/auth'
// ...
const agent = await validateHermesApiKey(token)
if (!agent) return NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401 })
```

**Sesudah:**
```ts
import { validateWorkerApiKey, extractBearerToken } from '@/lib/auth'
// ...
const agent = await validateWorkerApiKey(token)
if (!agent) return NextResponse.json({ error: 'Unauthorized — worker key required' }, { status: 401 })
```

---

## Execution Steps

```
STEP 1 — Fix src/app/api/hermes/tasks/route.ts
  - Ubah import: validateHermesApiKey → validateWorkerApiKey (GET handler)
  - Ubah import: validateHermesApiKey → validateWorkerApiKey (POST handler)
  - Ubah error message: 'Invalid or inactive API key' → 'Unauthorized — worker key required'

STEP 2 — Fix src/app/api/hermes/tasks/[id]/route.ts
  - Ubah import: validateHermesApiKey → validateWorkerApiKey
  - Ubah error message yang sama

STEP 3 — Self-refinement grep
  grep -rn "validateHermesApiKey" src/app/api/hermes/tasks/ --include="*.ts"
  # Hasil harus 0 — semua sudah diganti validateWorkerApiKey

  grep -rn "validateWorkerApiKey" src/app/api/hermes/tasks/ --include="*.ts"
  # Harus ada di kedua file (route.ts dan [id]/route.ts)

STEP 4 — Verify tidak ada endpoint lain yang expose worker state ke content agent
  grep -rn "validateHermesApiKey" src/app/api/hermes/ --include="*.ts"
  # Review setiap file yang muncul: apakah ada workerTask access tanpa isWorker guard?
  # File yang BOLEH: cpas/*, generate/*, library/*, credits/*, dll (content ops)
  # File yang TIDAK BOLEH: tasks/* (sudah difix di step 1-2)

STEP 5 — tsc --noEmit
  # Harus clean

STEP 6 — Commit
  git add src/app/api/hermes/tasks/route.ts src/app/api/hermes/tasks/[id]/route.ts
  git commit -m "fix(security): isolate worker task queue from content agents

  GET/POST /api/hermes/tasks and POST /api/hermes/tasks/[id] now require
  validateWorkerApiKey (isWorker=true) instead of validateHermesApiKey.
  Content agents (Hermes utama, Digipro) can no longer see or claim worker tasks."

STEP 7 — Final report
  Tulis docs/worker-isolation-report.md (template di bawah)
```

---

## Verify Post-Fix

Setelah fix, jalankan manual test:

```bash
# Test 1: Content agent key → harus 401
curl -H "Authorization: Bearer <CONTENT_AGENT_KEY>" \
  https://ai.boytenggara.com/api/hermes/tasks
# Expected: { "error": "Unauthorized — worker key required" }

# Test 2: Worker agent key → harus 200
curl -H "Authorization: Bearer <WORKER_AGENT_KEY>" \
  https://ai.boytenggara.com/api/hermes/tasks
# Expected: { tasks: [...] }

# Test 3: CPAS spawn masih jalan (content agent key)
curl -X POST -H "Authorization: Bearer <CONTENT_AGENT_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"userId":"...","productKey":"...","campaignSessionId":"...","cepData":{...}}' \
  https://ai.boytenggara.com/api/hermes/cpas/spawn-job
# Expected: { workerTaskId: "...", cepId: "..." }
```

---

## Template Final Report (docs/worker-isolation-report.md)

```markdown
# Worker Isolation Report — HSL
**Date:** 2026-06-15
**Auditor:** Fable 5
**Executor:** Sonnet

## Findings

| # | Severity | File | Issue | Status |
|---|---|---|---|---|
| 1 | CRITICAL | hermes/tasks/route.ts | Content agent bisa list worker queue (GET) | FIXED |
| 2 | CRITICAL | hermes/tasks/route.ts | Content agent bisa claim task (POST) | FIXED |
| 3 | HIGH | hermes/tasks/[id]/route.ts | Content agent bisa complete/fail task | FIXED |
| 4 | LOW | hermes/cpas/spawn-job/[id]/route.ts | No ownership check on PATCH | DEFERRED |

## Intentional Design (tidak diubah)
- cpas/slot-count: count-only, content agent boleh untuk capacity planning
- cpas/spawn-job: content agent CREATE task untuk worker (by design)
- cpas/spawn-job/[id] GET/PATCH: content agent monitor CPAS job sendiri

## Residual Risk
- [4] PATCH spawn-job/[id] tanpa ownership check — low risk (1 CPAS agent di prod)

## Verify Steps
[manual test commands from blueprint]
```

---

## Aturan Wajib

- Jangan ubah CPAS endpoints (`cpas/*`) — itu intentional design
- Jangan ubah `/api/worker/*` endpoints — itu sudah aman (pakai validateWorkerApiKey)
- `validateWorkerApiKey` sudah ada di `src/lib/auth.ts`, JANGAN buat ulang
- tsc --noEmit WAJIB clean sebelum commit
- DILARANG force-push ke main
- Kalau ambigu → tulis di report sebagai DEFERRED, lanjut
