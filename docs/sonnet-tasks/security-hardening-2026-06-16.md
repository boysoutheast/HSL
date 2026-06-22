# SONNET TASK — Security Hardening (2026-06-16)

> **Audit oleh Fable/Mac. Eksekusi oleh Sonnet/VPS. Prompt ini SELF-CONTAINED — semua yang lo butuh ada di sini.**
> Sumber audit: review 179 route API + verifikasi manual tiap finding kritikal.

---

## 0. ATURAN MAIN (WAJIB BACA SEBELUM MULAI)

1. **JANGAN** commit/log/print value credential apapun (token, secret, password, api key, ENCRYPTION_KEY).
2. **JANGAN** force-push. Push normal ke `main` aja.
3. **JANGAN** ubah logika di luar scope task ini. Fokus 8 fix di bawah.
4. Semua LLM call (kalau kesentuh) tetap lewat `src/lib/llm.ts` — jangan bikin client baru.
5. Tiap fix: **baca file dulu → ubah → `npx tsc --noEmit` → commit per-fix** dengan message jelas.
6. Setelah SEMUA fix: `npm run build` harus sukses sebelum push final.
7. Kalau ada fix yang ternyata mismatch sama kondisi kode aktual (nama field beda, dst), **STOP fix itu, lanjut yang lain, catat di laporan** — jangan nebak.
8. Akhiri dengan isi **LAPORAN EKSEKUSI** (format di Section 3) — kirim balik ke Mac.

Branch kerja: langsung `main` (deploy auto Railway). Commit granular per fix.

---

## 1. KONTEKS AUTH (fakta terverifikasi — percaya ini)

- `src/lib/auth.ts`:
  - `requireAuth(req)` → return `SessionUser` (user login apapun) atau `NextResponse` 401.
  - `requireAdmin(req)` → return `SessionUser` kalau `role==='admin'`, else `NextResponse` 403/401.
  - `validateHermesApiKey(token)` → return full `HermesAgent` record (termasuk `ownerUserId`) atau null.
  - Pattern pakai: `const auth = await requireAdmin(req); if (auth instanceof NextResponse) return auth`.
- `src/middleware.ts` cuma cek **cookie session ADA**, TIDAK validasi role. Jadi tiap route WAJIB auth sendiri.
- Session token = 256-bit random, divalidasi ke DB. Aman, gak bisa dipalsuin.
- Role: `'admin'` dan `'user'` (user dari self-register, `status='pending'` → di-approve admin).
- `HermesAgent.ownerUserId` (String?, nullable) = user pemilik agent itu.
- `WorkerTask.ownerUserId` (String?, nullable) = tenant pemilik task. `scope` = `'internal'` | `'user'`.

---

## 2. FIX LIST (urut prioritas)

### 🔴 FIX #1 — `posting-monitor/[accountId]` PATCH: tambah auth (CRITICAL)

**File:** `src/app/api/admin/posting-monitor/[accountId]/route.ts`

**Masalah:** PATCH handler NOL auth check. User `role=user` manapun bisa override posting monitor akun IG siapapun (status, lock, reassign Hermes agent).

**Current (awal file):**
```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { accountId: string } },
) {
  let body: {
```

**Ubah jadi:**
```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { accountId: string } },
) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  let body: {
```

**Catatan:** Pakai `requireAdmin` karena default reason di kode = "Manual override by admin" → ini aksi admin. Route induk `posting-monitor/route.ts` pakai `requireAuth`; KALAU ternyata user biasa secara desain memang perlu override monitor akunnya sendiri, catat di laporan (jangan diubah jadi requireAuth tanpa ownership check — itu masih bocor). Default: `requireAdmin`.

---

### 🔴 FIX #2 — `spawn-job/[id]` + `spawn-job` POST: scope ownership (CRITICAL, double bug)

**File A:** `src/app/api/hermes/cpas/spawn-job/[id]/route.ts`
**File B:** `src/app/api/hermes/cpas/spawn-job/route.ts`

**Masalah:**
- File A: GET & PATCH `findUnique({ where: { id } })` tanpa cek owner → agent key manapun bisa baca `resultJson` + tamper status/result task tenant lain.
- File B: POST set `ownerUserId: body.userId` (client-controlled!) → agent bisa bikin task atas nama user lain.

**Fix File A — GET handler.** Current:
```ts
  const { id } = await params
  const task = await prisma.workerTask.findUnique({
    where: { id },
    select: { id: true, type: true, status: true, resultJson: true, createdAt: true, completedAt: true },
  })

  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
```
Ubah jadi:
```ts
  const { id } = await params
  const task = await prisma.workerTask.findUnique({
    where: { id },
    select: { id: true, type: true, status: true, resultJson: true, createdAt: true, completedAt: true, ownerUserId: true },
  })

  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Cross-tenant guard: agent hanya boleh akses task miliknya. 404 (bukan 403) biar gak bocorin keberadaan id.
  if (!agent.ownerUserId || task.ownerUserId !== agent.ownerUserId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
```

**Fix File A — PATCH handler.** Current:
```ts
  const task = await prisma.workerTask.findUnique({ where: { id } })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
```
Ubah jadi:
```ts
  const task = await prisma.workerTask.findUnique({ where: { id } })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!agent.ownerUserId || task.ownerUserId !== agent.ownerUserId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
```

**Fix File B — POST.** Cari baris `ownerUserId: body.userId,` (sekitar line 70). Ubah jadi:
```ts
        ownerUserId: agent.ownerUserId ?? body.userId,
```
DAN tambah guard SEBELUM `prisma...create` (setelah validasi `required` & auth): kalau agent punya owner tapi beda dari body.userId, tolak.
```ts
  // Cegah agent bikin job atas nama user lain
  if (agent.ownerUserId && body.userId && body.userId !== agent.ownerUserId) {
    return NextResponse.json({ error: 'userId does not match agent owner' }, { status: 403 })
  }
```
> Pastikan variabel `agent` (hasil `validateHermesApiKey`) tersedia di scope POST File B. Kalau nama variabelnya beda, sesuaikan. Kalau File B belum manggil `validateHermesApiKey` sama sekali, BACA file-nya, pastikan ada auth-nya dulu — kalau gak ada, itu finding tambahan, catat di laporan.

---

### 🟠 FIX #3 — Webhook GeminiGen: tutup auth bypass + SSRF (HIGH)

**File A:** `src/app/api/webhooks/geminigen/route.ts`
**File B:** `src/lib/video-rehost.ts`

**Masalah:**
- File A line ~32: `if (expectedSecret && providedSecret && providedSecret !== expectedSecret)` → attacker tinggal GAK kirim header `x-geminigen-secret`, cek dilewati.
- File B: `media_url`/`thumbnail_url` dari body webhook di-`fetch()` server-side → SSRF.

**Fix File A.** Current:
```ts
  const expectedSecret = process.env.GEMINIGEN_WEBHOOK_SECRET
  const providedSecret = req.headers.get('x-geminigen-secret')
  if (expectedSecret && providedSecret && providedSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
```
Ubah jadi (terima secret via header ATAU query `?s=`, dan WAJIB kalau di-set):
```ts
  const expectedSecret = process.env.GEMINIGEN_WEBHOOK_SECRET
  if (expectedSecret) {
    const url = new URL(req.url)
    const providedSecret = req.headers.get('x-geminigen-secret') || url.searchParams.get('s')
    if (providedSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
```
> Konsekuensi: webhook URL yang didaftarkan ke GeminiGen harus jadi `https://ai.boytenggara.com/api/webhooks/geminigen?s=<GEMINIGEN_WEBHOOK_SECRET>`. Catat ini di laporan biar Mac update registrasi webhook. JANGAN tulis value secret-nya di laporan/commit — cukup tulis "perlu update URL webhook dengan ?s=<secret>".

**Fix File B — tambah guard SSRF.** Di `src/lib/video-rehost.ts`, tambah helper di atas + panggil sebelum tiap `fetch(sourceUrl)`:
```ts
function assertSafePublicUrl(raw: string): URL {
  let u: URL
  try { u = new URL(raw) } catch { throw new Error('Invalid URL') }
  if (u.protocol !== 'https:') throw new Error('Only https allowed')
  const host = u.hostname.toLowerCase()
  // Block private / loopback / link-local / metadata
  const blocked = [
    /^localhost$/, /^127\./, /^10\./, /^192\.168\./,
    /^169\.254\./, /^::1$/, /^0\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  ]
  if (blocked.some((re) => re.test(host))) throw new Error('Blocked host')
  // Allowlist domain GeminiGen CDN — sesuaikan kalau domain CDN beda
  const allowed = ['.geminigen.ai', '.googleapis.com', '.cloudfront.net', 'storage.googleapis.com']
  if (!allowed.some((d) => host === d.replace(/^\./, '') || host.endsWith(d))) {
    throw new Error(`Host not allowlisted: ${host}`)
  }
  return u
}
```
Panggil di awal `rehostVideo(sourceUrl)` dan `rehostThumbnail(sourceUrl)`:
```ts
  assertSafePublicUrl(sourceUrl)
```
> CDN host GeminiGen yang tepat mungkin beda. BACA log/kode untuk konfirmasi domain asli media_url GeminiGen. Kalau gak yakin, set allowlist sesuai domain yang muncul di `generatedMedia.mediaUrl` existing, dan CATAT di laporan supaya Mac verifikasi. Jangan sampai allowlist keketatan bikin rehost gagal — tapi lebih baik fail-closed + dicatat daripada SSRF kebuka.

---

### 🟠 FIX #4 — Cron fail-open → fail-closed (HIGH, laten)

**Files (5):**
- `src/app/api/cron/media-rules/route.ts`
- `src/app/api/cron/cleanup-sessions/route.ts`
- `src/app/api/cron/cleanup-locks/route.ts`
- `src/app/api/cron/posting-monitor/route.ts`
- `src/app/api/cron/fetch-metrics/route.ts`

**Masalah:** tiap file punya `if (!CRON_SECRET) return true` → kalau env `CRON_SECRET` gak keset, endpoint mutasi data jadi PUBLIC.

**Fix:** ubah jadi `return false` (fail-closed) di kelima file:
```ts
  const CRON_SECRET = process.env.CRON_SECRET
  if (!CRON_SECRET) return false   // fail-closed: tanpa secret, tolak semua
```
> ⚠️ PENTING: `CRON_SECRET` HARUS sudah keset di Railway sebelum deploy fix ini, kalau nggak cron job sendiri bakal ketolak (502/401) dan job berhenti. CATAT di laporan: "Mac wajib pastikan CRON_SECRET keset di Railway env sebelum/saat deploy." Kalau lo (Sonnet) bisa akses Railway dan CRON_SECRET ternyata KOSONG, STOP fix #4, catat di laporan — jangan deploy yang bikin cron mati.

---

### 🟡 FIX #5 — Webhook Telegram: tambah secret-token (MED)

**File:** `src/app/api/webhooks/telegram/route.ts`

**Masalah:** zero auth. Siapapun bisa POST `{message:{chat:{id},text}}` → inject pesan thread + trigger LLM responder.

**Fix:** di awal POST handler, tambah:
```ts
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (expected) {
    const provided = req.headers.get('x-telegram-bot-api-secret-token')
    if (provided !== expected) {
      return NextResponse.json({ ok: true }, { status: 200 }) // diamkan, jangan kasih sinyal ke attacker
    }
  }
```
> Telegram kirim header `X-Telegram-Bot-Api-Secret-Token` kalau di-set saat `setWebhook`. CATAT di laporan: "Mac perlu set `TELEGRAM_WEBHOOK_SECRET` di env + daftar ulang webhook Telegram dengan secret_token yang sama." Kalau env gak di-set, behavior lama (no auth) tetap jalan — jadi gak breaking, tapi belum aman sampai env diisi.

---

### 🟡 FIX #6 — `test-launches/[id]/submit` GET: cek ownership (MED)

**File:** `src/app/api/admin/test-launches/[id]/submit/route.ts`

**Masalah:** GET pakai `requireAuth` tapi gak cek ownership (POST udah cek). User lain bisa baca status launch + email requester/reviewer by id.

**Fix:** di GET handler, SETELAH `requireAuth` & SETELAH fetch `testLaunch`, tambah cek ownership. Tapi GET sekarang fetch pakai `select` tanpa `userId`. Tambah `userId: true` ke select, lalu:
```ts
  if (!testLaunch) {
    return NextResponse.json({ error: 'TestLaunch not found' }, { status: 404 })
  }
  if (testLaunch.userId !== auth.id && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
```
> Pastikan `auth` = hasil `requireAuth`. Tambahkan `userId: true` di objek `select` GET. Jangan return `userId` ke client kalau gak perlu — boleh tetap di select buat cek doang (atau hapus dari response object).

---

### 🟡 FIX #7 — `meta-accounts/[id]`: jangan balikin secret terenkripsi (MED)

**File:** `src/app/api/admin/meta-accounts/[id]/route.ts`

**Masalah:** GET & PATCH pakai `findUnique`/`update` TANPA `select` → balikin `appSecretEncrypted`, `shortLivedTokenEncrypted`, `longLivedTokenEncrypted` ke browser.

**Fix:** route ini kemungkinan stale (sister route `meta-connections/[id]` udah bener). Dua opsi — pilih A kalau ragu:

**Opsi A (aman, non-breaking):** tambah safe select. Di `src/app/api/admin/meta-connections/route.ts` line 8 ada `const SAFE_META_ACCOUNT_SELECT = {...}`. Copy object itu ke `meta-accounts/[id]/route.ts`, pakai di GET (`findUnique({ where, select: SAFE_META_ACCOUNT_SELECT })`) dan PATCH (`update({ ..., select: SAFE_META_ACCOUNT_SELECT })`).

**Opsi B (kalau confirmed gak ada caller):** grep `meta-accounts/` di `src/app` (selain route sendiri). Kalau ZERO caller di frontend, hapus folder route `meta-accounts/[id]/`. Catat keputusan di laporan.

> Default: **Opsi A**. Cuma pilih B kalau lo sudah grep & yakin gak ada yang manggil.

---

### 🟢 FIX #8 — Constant-time secret compare (LOW, opsional kalau waktu cukup)

Ganti `===` pada perbandingan secret jadi `crypto.timingSafeEqual` di:
- `src/app/api/internal/_lib/api-key-auth.ts`
- `src/app/api/webhooks/geminigen/route.ts` (yang udah lo ubah di #3)
- `src/app/api/meta/data-deletion/route.ts`

Helper aman (beda panjang harus return false dulu, jangan throw):
```ts
import { timingSafeEqual } from 'crypto'
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}
```
> Kalau mepet waktu, SKIP #8 — catat di laporan sebagai "deferred". Bukan blocker.

---

## VERIFIKASI SEBELUM PUSH

```bash
npx tsc --noEmit          # WAJIB no error
npm run build             # WAJIB sukses
```
Commit per-fix (8 commit kecil > 1 commit besar). Message format:
```
fix(security): #N <ringkas> — <file>
```
Push ke `main` (normal push, NO force). Railway auto-deploy.

---

## 3. FORMAT LAPORAN EKSEKUSI (Sonnet → kirim balik ke Mac)

```
# SONNET EXECUTION REPORT — Security Hardening 2026-06-16

## Ringkasan
- Fix selesai: __/8
- Fix di-skip/deferred: [list + alasan]
- tsc --noEmit: PASS/FAIL
- npm run build: PASS/FAIL
- Pushed commits: [list sha + message]

## Per-Fix
| # | Status | File(s) | Catatan/penyimpangan dari prompt |
|---|--------|---------|----------------------------------|
| 1 | ✅/⏭️/❌ | ... | ... |
| 2 | ... | ... | ... |
... (s/d 8)

## ACTION NEEDED dari Mac (env/config — JANGAN tulis value secret)
- [ ] GEMINIGEN_WEBHOOK_SECRET: update URL webhook GeminiGen jadi ?s=<secret> (#3)
- [ ] CRON_SECRET: pastikan keset di Railway sebelum deploy (#4)
- [ ] TELEGRAM_WEBHOOK_SECRET: set env + re-register webhook (#5)
- [ ] [lainnya kalau ada]

## Hal yang gak yakin / butuh keputusan Mac
- [domain CDN GeminiGen untuk allowlist SSRF — confirmed apa belum]
- [posting-monitor: requireAdmin vs user-own — keputusan?]
- [meta-accounts route: opsi A atau B yang dipilih]
```

---

## 4. MAC AUDIT REPORT — checklist verifikasi (DIISI FABLE/MAC setelah Sonnet selesai)

> Gue (Mac) verify ulang TIAP fix — bukan percaya laporan Sonnet doang. Re-read kode + cek exploit ketutup.

```
# MAC AUDIT REPORT — Security Hardening 2026-06-16
Verified by: Fable/Mac | Commit range: <base>..<head>

## Per-Fix Verification
| # | Fix | Cara verify | Bukti | Verdict |
|---|-----|-------------|-------|---------|
| 1 | posting-monitor auth | grep requireAdmin di PATCH; pastikan return auth instanceof check | <line> | PASS/FAIL |
| 2 | spawn-job ownership | baca GET+PATCH: ada `task.ownerUserId !== agent.ownerUserId → 404`? POST: ownerUserId dari agent? | <line> | PASS/FAIL |
| 3 | geminigen+SSRF | secret WAJIB saat di-set (header/query); assertSafePublicUrl dipanggil sebelum tiap fetch; allowlist masuk akal | <line> | PASS/FAIL |
| 4 | cron fail-closed | 5 file: `if (!CRON_SECRET) return false`; cek CRON_SECRET keset di Railway | <line> + env | PASS/FAIL |
| 5 | telegram auth | header x-telegram-bot-api-secret-token dicek saat env set | <line> | PASS/FAIL |
| 6 | submit GET ownership | userId di select + cek `!== auth.id && role!=='admin'` | <line> | PASS/FAIL |
| 7 | meta-accounts select | SAFE_META_ACCOUNT_SELECT dipakai GET+PATCH (atau route dihapus) | <line> | PASS/FAIL |
| 8 | timingSafeEqual | === diganti safeEqual di 3 file (atau deferred) | <line> | PASS/DEFERRED |

## Build/Deploy
- [ ] tsc --noEmit clean (re-run sendiri)
- [ ] npm run build clean (re-run sendiri)
- [ ] Railway deploy sukses + healthcheck OK
- [ ] Tiap ACTION NEEDED env udah dikerjain Mac

## Regression check (jangan sampai fix bikin rusak)
- [ ] Cron job masih jalan (cek deploy logs cron-* services, gak ada 401/502 storm)
- [ ] GeminiGen webhook masih nerima callback (cek generatedMedia transisi processing→completed)
- [ ] CPAS spawn-job flow normal untuk agent yang sah
- [ ] Login/approval flow gak kesentuh

## Sisa risiko / out-of-scope (lapor ke Boy, jangan auto-fix)
- #8 capi/events configId-as-secret (belum di-handle task ini)
- middleware pathname.includes('.') bypass (defense-in-depth)
- rate-limit in-memory (reset saat multi-instance/restart)

## Status akhir
DONE / PARTIAL / FAILED — <ringkas>
```

---

**Audit scope yang DICOVER task ini:** broken access control (#1,#2,#6), auth bypass webhook (#3,#5), SSRF (#3), fail-open (#4), credential exposure (#7), timing attack (#8).
**TIDAK dicover (sengaja, lapor terpisah):** capi/events configId, middleware dot-bypass, rate-limit persistence, SQL injection (sudah confirmed AMAN — semua Prisma parameterized).
