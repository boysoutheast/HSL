# Blueprint: User Isolation Audit & E2E Wiring Fix

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION
**Auditor:** Fable 5 (2026-06-15)
**Executor:** Sonnet
**Estimasi:** 20–30 menit

---

## Hasil Audit

Admin routes (`/api/admin/*`) → **AMAN** — 77 routes semua filter by `userId`/`createdByUserId`. Grade A.

Yang bermasalah ada di `gen/`, `internal/`, dan `photos/`:

---

## Temuan

### 🔴 CRITICAL — `/api/internal/actions` (GET + POST)
**File:** `src/app/api/internal/actions/route.ts`

**Masalah GET:** Query tanpa `userId` filter — siapapun dengan `WORKER_API_KEY` bisa lihat SEMUA automation actions dari semua user.
**Masalah POST:** `userId` di body langsung di-trust, tidak divalidasi — caller bisa create action on behalf of ANY user.

**Konteks:** Endpoint ini dipanggil oleh worker internal. Tapi kalau `WORKER_API_KEY` bocor → full exposure semua user data.

**Fix:**
```ts
// GET — tambah filter campaignSession.userId jika ada campaignSessionId:
// Ini internal endpoint, tapi tambah log audit + validasi campaignSessionId ownership

// Minimal fix: tambah log per akses agar bisa di-audit
// Full fix: validasi bahwa campaignSessionId yang diminta memang valid (exists in DB)
// Jangan perlu filter per userId karena ini worker internal — tapi HARUS ada di audit log
```

**Keputusan:** Ini endpoint worker-to-worker, bukan user-facing. `WORKER_API_KEY` adalah shared secret internal. **Fix-nya bukan isolation, tapi hardening:**
1. Validasi `campaignSessionId` exists di DB sebelum query (404 kalau tidak ada, bukan expose semua)
2. Tambah limit default ke GET (max 100, default 50) kalau belum ada
3. Log tiap akses ke `console.info` dengan timestamp + filter params

---

### 🔴 HIGH — `/api/gen/media/[id]` + `/api/gen/media/[id]/download`
**Files:**
- `src/app/api/gen/media/[id]/route.ts`
- `src/app/api/gen/media/[id]/download/route.ts`

**Masalah:** Kedua endpoint ini pakai `validateHermesApiKey` (Hermes agent key) — TAPI semua endpoint `/api/gen/*` lainnya pakai `requireApiKey` (user API key). Ini **auth protocol mismatch**.

User yang akses via user API key ke `GET /api/gen/media/[id]` akan dapat **401** karena salah auth type.

**Fix:**
```ts
// Ganti auth di kedua file:
// SEBELUM:
import { validateHermesApiKey, extractBearerToken } from '@/lib/auth'
const token = extractBearerToken(req.headers.get('authorization'))
const agent = await validateHermesApiKey(token)
if (!agent || media.userId !== agent.ownerUserId) ...

// SESUDAH:
import { requireApiKey } from '@/lib/api-key-auth'
const user = await requireApiKey(req)
if (user instanceof NextResponse) return user
if (!media || media.userId !== user.id) ...
```

Cek juga: apakah ada Hermes agent yang legitimately memanggil endpoint ini? Jika ya, tambahkan dual-auth fallback. Jika tidak, langsung ganti.

---

### 🟠 HIGH — `/api/photos/upload`
**File:** `src/app/api/photos/upload/route.ts`

**Masalah:** Field `characterId`, `topicId`, `productId`, `instagramAccountId` dari form data langsung di-insert ke DB tanpa verifikasi kepemilikan. User A bisa tag foto ke resource milik User B.

**Fix — tambah ownership check setelah parse formData:**
```ts
// Setelah parse formData, sebelum prisma.photoReference.create:
if (characterId) {
  const owns = await prisma.instagramAccount.findFirst({
    where: { characters: { some: { id: characterId } }, createdByUserId: user.id },
    select: { id: true },
  })
  if (!owns) return NextResponse.json({ error: 'characterId not owned' }, { status: 403 })
}

if (topicId) {
  const owns = await prisma.topic.findFirst({
    where: {
      id: topicId,
      OR: [
        { character: { instagramAccount: { createdByUserId: user.id } } },
        { product: { createdByUserId: user.id } },
      ],
    },
    select: { id: true },
  })
  if (!owns) return NextResponse.json({ error: 'topicId not owned' }, { status: 403 })
}

if (productId) {
  const owns = await prisma.product.findFirst({
    where: { id: productId, createdByUserId: user.id },
    select: { id: true },
  })
  if (!owns) return NextResponse.json({ error: 'productId not owned' }, { status: 403 })
}

if (instagramAccountId) {
  const owns = await prisma.instagramAccount.findFirst({
    where: { id: instagramAccountId, createdByUserId: user.id },
    select: { id: true },
  })
  if (!owns) return NextResponse.json({ error: 'instagramAccountId not owned' }, { status: 403 })
}
```

Kalau schema relasi berbeda (topicId di Topic model field berbeda), sesuaikan. STOP dan tulis DEFERRED kalau ragu.

---

### 🟡 MEDIUM — `/api/hermes/tasks/[id]` — payload.userId tidak divalidasi
**File:** `src/app/api/hermes/tasks/[id]/route.ts`
**Catatan:** Sudah di-fix ke `validateWorkerApiKey` (commit 9c61e31), tapi masalah ini berbeda.

**Masalah:** Saat task complete dengan `mediaAsset`, `payload.userId` dari `task.payloadJson` langsung dipakai untuk `MediaAsset.userId` tanpa verifikasi bahwa userId itu masuk scope worker.

**Fix:**
```ts
// Setelah parse payload, tambah validasi:
const payload = safeParse(task.payloadJson) as { userId?: string; productId?: string; characterId?: string } | null

// Tambah guard:
if (body.mediaAsset?.fileUrl && payload?.userId) {
  // Verifikasi bahwa task ini memang untuk userId yang valid (exists)
  const userExists = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true },
  })
  if (!userExists) {
    return NextResponse.json({ error: 'Invalid payload.userId' }, { status: 400 })
  }
  // ... lanjut create asset
}
```

---

### ℹ️ INFO — `/api/hermes/tasks` GET — Task Enumeration (Worker)
**File:** `src/app/api/hermes/tasks/route.ts` (sekarang sudah pakai `validateWorkerApiKey`)

**Status:** LOW RISK — setelah fix worker isolation, hanya worker agent yang bisa list tasks. Worker adalah single shared entity, bukan multi-tenant. **Tidak perlu difix.**

---

## Execution Steps

```
PHASE 1 — Critical + High (file by file)

STEP 1: Fix /api/gen/media/[id]/route.ts
  a. Baca file dulu — cek apakah ada Hermes agent yang call endpoint ini secara legitimate
  b. Jika tidak ada → ganti validateHermesApiKey → requireApiKey
  c. Ganti filter: agent.ownerUserId → user.id
  d. Update import

STEP 2: Fix /api/gen/media/[id]/download/route.ts
  a. Sama seperti STEP 1

STEP 3: Fix /api/photos/upload/route.ts
  a. Baca file dulu, lihat schema relasi
  b. Tambah 4 ownership checks (character, topic, product, instagramAccount)
  c. Jika relasi berbeda dari yang diassumsi → STOP, tulis DEFERRED, lanjut

STEP 4: Harden /api/internal/actions/route.ts
  a. GET: tambah validasi kampanye ada di DB kalau campaignSessionId di-pass
  b. GET: pastikan ada default limit (max 100)
  c. POST: tambah validasi userId exists di DB (bukan ownership, cukup existence)
  d. Tambah console.info audit log per akses

STEP 5: Fix /api/hermes/tasks/[id]/route.ts — payload userId validation
  a. Tambah guard: userExists check sebelum create MediaAsset

PHASE 2 — E2E Wiring Verify

STEP 6: E2E flow check — gen/media/[id]
  Setelah fix auth, verifikasi:
  - GET /api/gen/media (list) → requireApiKey → userId filter ✓
  - GET /api/gen/media/[id] → setelah fix → requireApiKey → userId filter ✓
  - Grep: apakah ada kode yang call /api/gen/media/[id] dengan Hermes key?
    grep -rn "gen/media" src/ --include="*.ts" | grep -v "route.ts\|__tests__"

STEP 7: E2E flow check — video generation end-to-end
  Verifikasi chain berikut fully wired:
  a. POST /api/gen/video → creates GeneratedMedia + WorkerTask (scope='user')
  b. Worker picks up task → updates GeneratedMedia status
  c. Webhook → /api/hermes/generate/video/webhook → sets status=completed + videoUrl
  d. Hash: completedAt set, mediaHash generated
  e. GET /api/gen/video/[id] → returns mediaHash

  Grep: apakah mediaHash di-return di /api/gen/video/[id]?
    grep -n "mediaHash" src/app/api/gen/video/\[id\]/route.ts

  Kalau tidak ada → tambahkan ke select

STEP 8: E2E flow check — credits
  Verifikasi:
  - debitCredits → txHash generated ✓ (dari hash-receipt session sebelumnya)
  - GET /api/gen/credits → txHash ada di response?
    grep -n "txHash" src/app/api/gen/credits/route.ts
  - Kalau tidak → tambahkan ke select

PHASE 3 — Self-Refinement

STEP 9: Grep remaining isolation gaps
  # Cek apakah ada endpoint gen/ yang masih pakai validateHermesApiKey:
  grep -rn "validateHermesApiKey" src/app/api/gen/ --include="*.ts"
  # Harus 0 setelah fix

  # Cek apakah photos/upload sudah ada ownership check:
  grep -n "owns\|createdByUserId\|not owned" src/app/api/photos/upload/route.ts

  # Cek semua endpoint yang pakai requireApiKey — pastikan ada userId filter:
  grep -rn "requireApiKey" src/app/api/ --include="*.ts"
  # Review tiap file — apakah ada yang query tanpa where: { userId: user.id }?

STEP 10: tsc --noEmit → harus clean sebelum commit

STEP 11: Commit per phase
  Phase 1 commit:
    git add src/app/api/gen/media/ src/app/api/photos/upload/route.ts src/app/api/internal/actions/route.ts src/app/api/hermes/tasks/\[id\]/route.ts
    git commit -m "fix(security): user isolation gaps — gen/media auth, photos ownership, internal actions hardening"

  Phase 2 commit (kalau ada perubahan E2E):
    git add src/app/api/gen/
    git commit -m "fix(wiring): expose mediaHash + txHash in gen endpoints"

STEP 12: Buat docs/user-isolation-report.md
```

---

## Template Report (docs/user-isolation-report.md)

```markdown
# User Isolation Report — HSL
**Date:** 2026-06-15
**Auditor:** Fable 5
**Executor:** Sonnet

## Admin Routes Audit
Grade: A — 77/77 routes properly filtered. No violations.

## Findings

| # | Severity | File | Issue | Status |
|---|---|---|---|---|
| 1 | HIGH | gen/media/[id]/route.ts | Auth mismatch: Hermes key bukan user key | FIXED |
| 2 | HIGH | gen/media/[id]/download/route.ts | Sama | FIXED |
| 3 | HIGH | photos/upload/route.ts | No ownership check pada characterId/topicId/productId/instagramAccountId | FIXED |
| 4 | MEDIUM | hermes/tasks/[id]/route.ts | payload.userId tidak divalidasi existence | FIXED |
| 5 | INFO | internal/actions/route.ts | Worker internal — hardened, bukan isolation issue | HARDENED |

## E2E Wiring
| Flow | Status |
|---|---|
| gen/video → mediaHash di response | VERIFIED / FIXED |
| gen/credits → txHash di response | VERIFIED / FIXED |
| photos/upload → ownership checked | FIXED |

## Deferred
[items tidak difix + alasan]

## Residual Risk
[risiko yang masih ada]
```

---

## Aturan Wajib

- Jangan ubah admin routes — semua sudah aman
- Kalau relasi Prisma di photos/upload berbeda dari asumsi → STOP, tulis DEFERRED
- Sebelum ganti auth di gen/media — cek dulu ada Hermes caller tidak. Kalau ada → STOP, lapor ke report
- tsc --noEmit WAJIB clean sebelum tiap commit
- DILARANG force-push ke main
- Commit per phase (Phase 1 + Phase 2 terpisah)
- Kalau ambigu → DEFERRED, jangan auto-fix
