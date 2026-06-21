# Blueprint: Security Remediation End-to-End (2026-06-21)

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION
**Auditor:** Fable 5 · **Executor:** Sonnet (VPS)
**Estimasi:** 30–45 menit

> Catatan: temuan CRITICAL/HIGH lain sudah di-fix di commit `c5ec6ef`
> (feature-flags auth, worker/tasks IDOR, poll-geminigen fail-closed, timing-safe).
> Blueprint ini menutup sisa celah: worker/tokens, internal broad-scope, worker/events DoS,
> content-log tagging, error leakage, webhook secret. Semua step self-contained di sini.

---

## ATURAN WAJIB
- Baca file dulu sebelum tiap edit. Jangan tebak schema — kalau field/relasi beda dari blueprint, STOP, tulis DEFERRED.
- JANGAN matikan fungsi worker. Kalau fix bisa breaking, STOP + DEFERRED.
- `npx prisma generate` dulu kalau tsc error soal Prisma field (client lokal sering stale).
- `npx tsc --noEmit` WAJIB clean (selain error pre-existing `driver.js` di `useTour.ts` — itu bukan urusan kita).
- DILARANG force-push ke main. `git pull --rebase` kalau push ketolak.
- Commit per PHASE, bukan satu commit besar.
- Tiap PHASE yang touch auth: jangan ubah behavior untuk caller yang valid — cuma tambah guard.

---

## PHASE 1 — `worker/tokens/[metaConnectionId]` (Opsi 3: accept + harden)

**File:** `src/app/api/worker/tokens/[metaConnectionId]/route.ts`

**Masalah:** return raw decoded Meta token untuk metaConnectionId APAPUN, tanpa scope binding. Worker key bocor = panen semua token.

**Keputusan owner:** Opsi 3 — terima risiko (worker memang butuh token), tapi harden:

### Step 1a — Audit log tiap akses token
Tambah `console.info` (TIDAK pernah log nilai token) tiap kali token diakses:
```ts
// setelah validateWorkerApiKey sukses, sebelum return token:
console.info(`[worker/tokens] access by agent=${agent.id} (${agent.name}) connection=${metaConnectionId} at ${new Date().toISOString()}`)
```

### Step 1b — Optional IP allowlist via env
Tambah guard di awal handler (setelah auth), HANYA aktif kalau env diset (jadi tidak breaking kalau env kosong):
```ts
const allowlist = process.env.WORKER_IP_ALLOWLIST // comma-separated, optional
if (allowlist) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
  const allowed = allowlist.split(',').map(s => s.trim()).filter(Boolean)
  if (!allowed.includes(ip)) {
    console.warn(`[worker/tokens] BLOCKED ip=${ip} not in allowlist, connection=${metaConnectionId}`)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
}
```
Tambah `WORKER_IP_ALLOWLIST=` (kosong, placeholder + komentar) ke `.env.example`.

### Step 1c — Scope-bind (CONDITIONAL)
Cek schema: apakah ada relasi MetaAccount → HermesAgent/worker (mis. field `assignedWorkerId`, atau Assignment dengan `assignableType='meta_account'`)?
- Kalau ADA → tambah filter di `findUnique`/`findFirst` agar worker cuma bisa ambil token connection yang di-assign ke dia.
- Kalau TIDAK ADA model assignment-nya → tulis di report "scope-bind DEFERRED: tidak ada model assignment MetaAccount→worker, butuh keputusan owner buat bikin". JANGAN bikin model baru sendiri.

**Verify:** worker key + connection id valid → masih 200 + token (fungsi worker tidak rusak). Log muncul di output. Tanpa x-api-key → 401.

---

## PHASE 2 — `internal/worker/events` rate limit (DoS / unbounded LLM spend)

**File:** `src/app/api/internal/worker/events/route.ts`

**Masalah:** tiap POST trigger `runSaasResponder` (LLM) fire-and-forget tanpa batas. Key valid bisa spam → biaya LLM membengkak.

**Fix:** dedup via `eventId` (sudah idempotent via unique event_id — konfirmasi dulu dengan baca file) + tambah guard: hanya jalankan `runSaasResponder` kalau event benar-benar baru (bukan replay). Kalau idempotency sudah ada tapi LLM tetap jalan tiap call, pindahkan `runSaasResponder` ke SETELAH cek "event sudah ada → skip".

Pola:
```ts
// cek apakah event sudah pernah diproses (unique eventId)
const existing = await prisma.<eventModel>.findUnique({ where: { eventId: body.eventId } })
if (existing) {
  return NextResponse.json({ ok: true, deduped: true })  // jangan trigger LLM lagi
}
// ... create event ...
// HANYA trigger runSaasResponder untuk event baru:
runSaasResponder(...).catch(err => console.error('[worker/events] responder failed', err))
```
Baca dulu nama model event-nya di file (jangan tebak). Kalau struktur sudah dedup dengan benar dan LLM hanya jalan untuk event baru → tulis "sudah aman" di report, no change.

**Verify:** POST event baru → LLM jalan 1×. POST eventId yang sama lagi → deduped, LLM TIDAK jalan.

---

## PHASE 3 — `content-log` write-side assignment check

**File:** `src/app/api/hermes/content-log/route.ts`

**Masalah:** account (`instagramAccountId`) sudah diverifikasi assignment-nya, TAPI `topicId/productId/cepId/characterId` ditulis tanpa cek — agent bisa nge-tag log ke resource milik agent lain.

**Fix:** mirror pola dari `cep-feedback`. Setelah cek account assignment yang sudah ada, tambah cek topic + product (kalau dikirim):
```ts
if (body.topicId) {
  const a = await prisma.assignment.findFirst({
    where: { hermesAgentId: agent.id, assignableType: 'topic', assignableId: body.topicId, status: 'active' },
  })
  if (!a) return NextResponse.json({ error: 'Topic not assigned to this agent' }, { status: 403 })
}
if (body.productId) {
  const a = await prisma.assignment.findFirst({
    where: { hermesAgentId: agent.id, assignableType: 'product', assignableId: body.productId, status: 'active' },
  })
  if (!a) return NextResponse.json({ error: 'Product not assigned to this agent' }, { status: 403 })
}
```
Untuk `cepId` & `characterId`: cek apakah ada assignment type-nya. `cep` → assignableType 'cep'. `character` → assignableType 'character'. Kalau ragu apakah agent biasa punya assignment tipe itu, cek di library route bagaimana cep/character di-resolve, lalu tambah cek serupa ATAU tulis DEFERRED dengan alasan. Jangan over-block sampai bikin flow normal gagal.

**Verify:** content-log dengan topicId/productId yang di-assign → sukses. Dengan id milik agent lain → 403.

---

## PHASE 4 — Error leakage: generic-kan `String(err)` / `err.message` di response

**Target:** response yang kirim detail error mentah ke client. Cari:
```bash
grep -rn "String(err)\|String(e)\|err\.message\|e\.message\|error\.message" src/app/api/ --include="*.ts" | grep -i "NextResponse.json"
```

**Fix tiap temuan:** log detail di server, return generic ke client:
```ts
// SEBELUM:
return NextResponse.json({ error: String(err) }, { status: 500 })
// SESUDAH:
console.error('[<route-name>]', err)
return NextResponse.json({ error: 'Internal error' }, { status: 500 })
```
Prioritas: `meta-connections/route.ts:~113` (OAuth exchange, bisa bocor detail Meta). Cron routes auth-gated jadi lower priority tapi tetap rapikan kalau cepat.
JANGAN ubah error response yang memang informatif & aman (validasi input 400 dengan pesan jelas — itu OK, biarkan).

**Verify:** trigger error → client dapat pesan generic, detail tetap ada di server log.

---

## PHASE 5 — Webhook secret: pastikan fail-closed kalau env diset

**Files:** `src/app/api/webhooks/telegram/route.ts`, `src/app/api/webhooks/geminigen/route.ts`

**Masalah:** auth secret optional (`if (expected) {...}`) — kalau env unset, no auth.

**Fix:** ini terutama ops (pastikan env ke-set di Railway). Di kode: pastikan KALAU env diset, verifikasi WAJIB lulus (sudah begitu). Tidak perlu ubah behavior optional (webhook eksternal kadang belum config secret). Cukup:
- Konfirmasi `geminigen` pakai timing-safe compare (sudah, per audit).
- Untuk `telegram`: kalau `TELEGRAM_WEBHOOK_SECRET` diset, verifikasi timing-safe; kalau belum diset, log `console.warn` sekali bahwa webhook tidak terproteksi.
- Tulis di report: env mana yang HARUS di-set di Railway (`TELEGRAM_WEBHOOK_SECRET`, geminigen webhook secret).

Ini PHASE paling ringan — kalau ragu, cukup tambah `console.warn` saat secret unset + catat di report, jangan ubah logic.

---

## PHASE 6 — Self-Refinement + Verify

```bash
# 1. Tidak ada lagi plaintext === untuk WORKER_API_KEY/CRON_SECRET di compare
grep -rn "=== process.env.WORKER_API_KEY\|!== process.env.WORKER_API_KEY\|=== process.env.CRON_SECRET\|!== process.env.CRON_SECRET" src/app/api/ --include="*.ts"
# Idealnya 0 (semua lewat timingSafeEqual helper). Kalau ada sisa, fix atau DEFERRED.

# 2. Tidak ada endpoint internal/worker tanpa auth
grep -rLn "validateApiKey\|validateWorkerApiKey\|WORKER_API_KEY\|getSessionUser\|requireA" src/app/api/internal --include="route.ts"
# Tiap file yang muncul: pastikan memang public by-design, atau tambah auth.

# 3. Token field tidak bocor ke response
grep -rn "longLivedTokenEncrypted\|shortLivedTokenEncrypted\|apiKeyHash\|keyHash\|accessTokenEncrypted" src/app/api/ --include="*.ts" | grep -i "NextResponse.json"
# Harus 0 (token cuma dipakai internal, jangan di response). worker/tokens return decoded token = by-design (PHASE 1).

# 4. tsc
npx prisma generate
npx tsc --noEmit
```

---

## PHASE 7 — Commit + Report

Commit per phase (atau gabung yang logis):
```
git add <files phase 1> && git commit -m "fix(security): harden worker/tokens — audit log + optional IP allowlist"
git add <files phase 2> && git commit -m "fix(security): worker/events dedup — no LLM trigger on replay"
git add <files phase 3> && git commit -m "fix(security): content-log verify topic/product assignment"
git add <files phase 4> && git commit -m "fix(security): generic error responses, log detail server-side"
git add <files phase 5> && git commit -m "fix(security): warn on unset webhook secret"
git pull --rebase origin main && git push origin main
```

Buat `docs/security-remediation-2026-06-21-report.md`:
```markdown
# Security Remediation Report — 2026-06-21
Executor: Sonnet | Auditor target: Fable

| Phase | Item | Status | Commit | Notes |
|---|---|---|---|---|
| 1 | worker/tokens harden | DONE/DEFERRED | <hash> | scope-bind: [ada/tidak ada model] |
| 2 | worker/events dedup | DONE/AMAN | <hash> | |
| 3 | content-log tagging | DONE/DEFERRED | <hash> | cep/character: [...] |
| 4 | error leakage | DONE | <hash> | N lokasi di-generic-kan |
| 5 | webhook secret | DONE | <hash> | env yang harus di-set: [...] |

## ENV yang harus di-set di Railway
- WORKER_IP_ALLOWLIST (optional)
- TELEGRAM_WEBHOOK_SECRET
- [geminigen webhook secret]

## Deferred + alasan
[...]

## tsc status
[clean / sisa driver.js pre-existing]
```

Kirim ke Boy: ringkasan FIXED vs DEFERRED + commit hashes + env yang perlu di-set + status tsc.
```
