# Blueprint: Security Hardening — HSL Full Audit & Fix

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION
**Auditor:** Fable 5 (2026-06-14)
**Executor:** Sonnet (eksekusi semua fix, self-refinement, final report)
**Estimasi:** 25–35 menit nonstop

---

## Temuan Audit (prioritized)

### 🔴 CRITICAL — SQL Injection

**File:** `src/app/api/internal/monitor/metrics/batch/route.ts`
**Line:** ~50–85 (fungsi values builder + executeRawUnsafe)

**Masalah:** String interpolasi langsung ke `$executeRawUnsafe`. Field `m.campaignSessionId`, `m.metaEntityId`, `m.entityType`, `m.windowEnd` dari request body di-embed ke SQL string tanpa parameterisasi.

```ts
// VULNERABLE — user input langsung ke SQL:
return `(
  '${m.campaignSessionId}',   // ← SQL injection here
  '${m.metaEntityId}',        // ← SQL injection here
  '${m.entityType}',          // ← SQL injection here
  '${windowStart}',
  '${windowEnd}',
  ...
)`
// kemudian:
await prisma.$executeRawUnsafe(upsertSql)
```

**Exploit:** POST ke `/api/internal/monitor/metrics/batch` dengan `metaEntityId: "x', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL); DROP TABLE metric_snapshots; --"` → SQL executed langsung.

**Fix:** Ganti `$executeRawUnsafe` + string interpolation → `$executeRaw` tagged template (parameterized), ATAU ubah ke Prisma upsert per-row (lebih clean, slightly slower tapi safe).

Rekomendasi: ubah ke per-row Prisma upsert dengan `createMany` + `skipDuplicates: false` + manual `updateMany` per batch. Atau gunakan `$queryRaw` tagged template dengan array param binding.

```ts
// SAFE — gunakan $executeRaw tagged template:
await prisma.$executeRaw`
  INSERT INTO metric_snapshots (campaign_session_id, meta_entity_id, ...)
  VALUES (${m.campaignSessionId}, ${m.metaEntityId}, ...)
  ON CONFLICT (...) DO UPDATE SET ...
`
// Tapi karena bulk insert butuh loop, ubah ke per-row upsert:
for (const m of body) {
  await prisma.metricSnapshot.upsert({
    where: { campaignSessionId_metaEntityId_windowEnd: { ... } },
    create: { ... },
    update: { ... },
  })
}
```

Cek unique constraint name di schema (`@@unique`) untuk tahu field composite key yang benar.

---

### 🔴 HIGH — Mass Assignment (Hermes Agent PATCH)

**File:** `src/app/api/admin/hermes-agents/[id]/route.ts`
**Line:** ~59–74

**Masalah:** `const { rotateApiKey, ...updateData } = body` → `data: updateData` langsung ke Prisma. Caller bisa inject field apapun dari HermesAgent schema: `apiKeyHash`, `isWorker`, `ownerUserId`, `status`, dll.

```ts
// VULNERABLE:
const { rotateApiKey, ...updateData } = body
// updateData bisa berisi: { isWorker: true, apiKeyHash: 'attacker_hash', ownerUserId: 'other_id' }
const agent = await prisma.hermesAgent.update({
  where: { id: params.id },
  data: updateData,   // ← MASS ASSIGNMENT
})
```

**Exploit:** PATCH dengan body `{ "isWorker": true }` → content agent jadi worker agent, bisa akses `/api/worker/*`.

**Fix:** Allowlist eksplisit field yang boleh diupdate:

```ts
const allowedUpdate: Partial<{ name: string; status: string; notes: string }> = {}
if (typeof body.name === 'string') allowedUpdate.name = body.name.trim().slice(0, 100)
if (typeof body.status === 'string' && ['active', 'inactive'].includes(body.status)) allowedUpdate.status = body.status
if (typeof body.notes === 'string') allowedUpdate.notes = body.notes.trim().slice(0, 1000)

const agent = await prisma.hermesAgent.update({
  where: { id: params.id },
  data: { ...allowedUpdate, ...(newRawApiKey ? { apiKeyHash: hashApiKey(newRawApiKey) } : {}) },
})
```

---

### 🟠 HIGH — Input Length Tidak Dibatasi (DoS via Large Payload)

**File:** Banyak route — contoh:
- `src/app/api/admin/accounts/[id]/route.ts` — characterDescription, behavior, speakingStyle, dll.
- `src/app/api/admin/ceps/[id]/route.ts` — cepText, painPoint
- `src/app/api/admin/test-launches/route.ts` — name, targeting JSON

**Masalah:** Field teks tidak punya max-length check. Attacker bisa kirim 10MB string → DB row bloat / memory spike.

**Fix:** Tambah helper dan gunakan di semua route:

```ts
// src/lib/validate.ts (buat file baru)
export function str(val: unknown, max: number): string | null {
  if (typeof val !== 'string') return null
  return val.trim().slice(0, max) || null
}
export function strRequired(val: unknown, max: number): string | undefined {
  const s = str(val, max)
  return s ?? undefined
}
```

Batas recommended:
- Name/label: 200 chars
- Description/notes: 2000 chars
- LLM prompt/copy: 5000 chars
- JSON payload (rule/targeting): 50000 chars
- CEP text, behavior, persona fields: 3000 chars

Implementasi: wrap semua string assignment dari body dengan `str(body.field, MAX)`.

---

### 🟠 HIGH — workerId Tidak Divalidasi (Task Claim Poisoning)

**File:** `src/app/api/internal/worker/tasks/claim/route.ts`
**Line:** ~25–30

**Masalah:** `workerId` dari body langsung ditulis ke `worker_tasks.worker_id` tanpa validasi format/length. Worker bisa claim task dengan workerId arbitrary — menyamar sebagai worker lain.

**Fix:**
```ts
if (!workerId || typeof workerId !== 'string' || workerId.length > 100) {
  return NextResponse.json({ error: 'workerId invalid' }, { status: 400 })
}
// Opsional: verifikasi workerId match dengan worker registry
const registered = await prisma.workerRegistry.findFirst({
  where: { workerId },
})
if (!registered) {
  return NextResponse.json({ error: 'Worker not registered' }, { status: 403 })
}
```

---

### 🟡 MEDIUM — Error Response Bocorkan Internal Detail

**File:** `src/app/api/internal/worker/tasks/claim/route.ts`
**Line:** ~100

**Masalah:**
```ts
return NextResponse.json({ error: 'Failed to claim tasks', message }, { status: 500 })
// message = err.message yang bisa berisi stack trace, query detail, dll.
```

**Fix:** Log ke server, return generic message ke client:
```ts
console.error('[worker/tasks/claim]', err)
return NextResponse.json({ error: 'Internal error' }, { status: 500 })
```

Cek semua route yang return `message: err.message` ke client — ganti dengan generic.

---

### 🟡 MEDIUM — allowedEvents Tidak Divalidasi (CAPI Config)

**File:** `src/app/api/admin/capi-configs/[id]/route.ts`
**Line:** ~35

**Masalah:**
```ts
...(Array.isArray(body.allowedEvents) ? { allowedEvents: body.allowedEvents } : {})
// Tidak ada validasi bahwa isi array adalah string valid Meta event names
```

**Fix:**
```ts
const VALID_EVENTS = ['Purchase', 'Lead', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'PageView', 'CompleteRegistration']
if (Array.isArray(body.allowedEvents)) {
  const filtered = body.allowedEvents.filter((e: unknown) => typeof e === 'string' && VALID_EVENTS.includes(e))
  if (filtered.length !== body.allowedEvents.length) {
    return NextResponse.json({ error: 'Invalid event name in allowedEvents' }, { status: 400 })
  }
  updateData.allowedEvents = filtered
}
```

---

### 🟡 MEDIUM — Inactive User Session Tidak Di-cleanup

**File:** `src/lib/session.ts`
**Line:** ~30–40

**Masalah:** Jika user di-deactivate, `getSessionUser` return null tapi session row tidak dihapus. Session tetap di DB sampai expire (8 jam). Minor, tapi cleanup is good hygiene.

**Fix:**
```ts
if (session.user.status !== 'active') {
  await prisma.session.delete({ where: { token } }).catch(() => {})  // cleanup
  return null
}
```

---

### 🟡 MEDIUM — `parseInt` Tanpa NaN Guard (beberapa route)

**File:**
- `src/app/api/admin/creative-rotations/route.ts` line 17–18
- `src/app/api/admin/creative-reservations/route.ts` line 17
- `src/app/api/admin/content-logs/route.ts` line 19

**Masalah:** `parseInt(searchParams.get('offset') || '0')` bisa return NaN jika input bukan angka (e.g., `?offset=abc`). NaN di Prisma `skip` di-convert ke 0 secara diam-diam tapi tidak konsisten di semua versi.

**Fix:**
```ts
const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0)
// `|| 0` menangkap NaN (NaN || 0 = 0)
```

---

### 🟡 MEDIUM — Metrics Batch: Tidak Ada Limit Array Size

**File:** `src/app/api/internal/monitor/metrics/batch/route.ts`

**Masalah:** Array body tidak dibatasi jumlahnya. Kirim 100.000 metric → OOM / timeout.

**Fix:**
```ts
if (body.length > 500) {
  return NextResponse.json({ error: 'Max 500 metrics per batch' }, { status: 400 })
}
```

---

### 🟡 MEDIUM — windowEnd Tidak Divalidasi sebagai Valid Date

**File:** `src/app/api/internal/monitor/metrics/batch/route.ts`

**Masalah:** `new Date(m.windowEnd).toISOString()` — jika `windowEnd` bukan string/number valid, hasilnya `Invalid Date` → `.toISOString()` throw → uncaught exception → 500.

**Fix:**
```ts
const windowEndDate = new Date(m.windowEnd)
if (isNaN(windowEndDate.getTime())) {
  return NextResponse.json({ error: `Invalid windowEnd at index ${i}` }, { status: 400 })
}
```

---

### 🟢 LOW — Content-Type Tidak Divalidasi pada POST Endpoints

Beberapa endpoint POST tidak memverifikasi `Content-Type: application/json`. Tidak exploitable karena Next.js parse body hanya kalau content-type cocok, tapi defensive coding yang baik.

**Fix (opsional):**
```ts
if (!req.headers.get('content-type')?.includes('application/json')) {
  return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 })
}
```
Implementasikan hanya di endpoint sensitif (auth, credits, grant).

---

### 🟢 LOW — Tidak Ada Request Body Size Limit Global

Next.js default body limit = 4MB. Untuk endpoint yang tidak butuh file upload, ini bisa dikurangi. Tidak kritis tapi worth noting.

---

## Execution Order

```
PHASE 1 — CRITICAL (wajib pertama)
  1. Fix SQL injection di metrics/batch: ganti $executeRawUnsafe → per-row Prisma upsert
  2. Fix mass assignment di hermes-agents/[id] PATCH: tambah allowlist field

PHASE 2 — HIGH
  3. Tambah src/lib/validate.ts (str helper)
  4. Implementasikan str() di route-route dengan field teks tidak ter-limit:
     - accounts/[id] PATCH
     - ceps/[id] PATCH
     - test-launches POST/PATCH
     - admin/auth/register POST
  5. Fix workerId validation di worker/tasks/claim

PHASE 3 — MEDIUM
  6. Fix error response leakage: ganti semua `message: err.message` di api response → generic
  7. Fix allowedEvents validation di capi-configs/[id]
  8. Fix inactive user session cleanup di session.ts
  9. Fix parseInt NaN guard (creative-rotations, creative-reservations, content-logs)
  10. Tambah array size limit di metrics/batch
  11. Tambah windowEnd date validation di metrics/batch

PHASE 4 — SELF REFINEMENT
  12. Grep ulang semua route untuk pola yang sama:
      - "$executeRaw" + string concat → wajib fix
      - "...updateData" atau "...body" spread ke Prisma data → wajib allowlist
      - "err.message" di NextResponse.json → wajib generickan
      - Array dari body tanpa length check → tambah limit
  13. tsc --noEmit → fix semua error yang berkaitan dengan perubahan di atas
  14. Review diff total sebelum commit

PHASE 5 — FINAL REPORT
  15. Buat file docs/security-audit-report.md dengan:
      - Semua temuan + status (FIXED / SKIPPED / DEFERRED)
      - Commit hash per fix
      - Confidence level tiap fix
      - Sisa risiko yang belum ditutup
      - Rekomendasi lanjutan
```

---

## Aturan Wajib

- Jangan touch schema Prisma untuk fix ini — semua fix di level application code
- Jangan ubah behavior fungsional — hanya tambah validasi dan sanitasi
- Commit per phase, bukan satu commit besar
- DILARANG force-push ke main
- tsc --noEmit WAJIB clean sebelum tiap commit
- Tidak boleh ada token/key di log atau response
- Worker task status tetap lowercase
- Kalau ada fix yang ambigu atau bisa breaking → STOP, tulis di report sebagai DEFERRED, lanjut ke item berikutnya

---

## Self-Refinement Checklist (PHASE 4 — wajib dijalankan)

Setelah semua fix selesai, jalankan grep-grep ini dan perbaiki yang ditemukan:

```bash
# 1. Raw SQL string interpolation
grep -rn "\$executeRawUnsafe\|\$executeRaw\`" src/app/api/ | grep -v "//.*fix\|SAFE"

# 2. Spread body ke Prisma (mass assignment risk)
grep -rn "data: \.\.\.body\|data: updateData\b" src/app/api/ --include="*.ts"

# 3. err.message di response
grep -rn "message.*err\.message\|err\.message.*message" src/app/api/ --include="*.ts"

# 4. Array dari body tanpa length check
grep -rn "Array\.isArray(body\." src/app/api/ --include="*.ts"

# 5. parseInt tanpa || 0 guard
grep -rn "parseInt(" src/app/api/ --include="*.ts" | grep -v "|| 0\|Math\."
```

Tiap hasil yang ditemukan → fix atau tambahkan ke report sebagai DEFERRED dengan alasan.

---

## Template Final Report (docs/security-audit-report.md)

```markdown
# Security Audit Report — HSL
**Date:** 2026-06-14
**Auditor:** Fable 5
**Executor:** Sonnet

## Summary
- CRITICAL: X/X fixed
- HIGH: X/X fixed
- MEDIUM: X/X fixed
- LOW: X/X fixed

## Findings Detail

| # | Severity | File | Issue | Status | Commit |
|---|---|---|---|---|---|
| 1 | CRITICAL | metrics/batch | SQL injection $executeRawUnsafe | FIXED | abc1234 |
...

## Deferred Items
[items yang tidak difix + alasan]

## Residual Risk
[risiko yang masih ada setelah semua fix]

## Recommendations
[hal lanjutan yang perlu dilakukan]
```
