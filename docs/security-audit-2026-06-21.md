# Security Audit — HSL (2026-06-21)

**Auditor:** Fable 5 (3 parallel agents: hermes-scope, secret-leak, public/internal surface)
**Method:** static read + live black-box test prod
**Scope:** seluruh `src/app/api/**` + `src/lib/` auth/crypto

---

## Ringkasan

| Severity | Temuan | Status |
|---|---|---|
| 🔴 CRITICAL | `worker/tokens/[metaConnectionId]` — raw Meta token, no scope | **NEEDS DECISION** |
| 🔴 HIGH | `internal/feature-flags/check` — ZERO auth | ✅ FIXED (c5ec6ef) |
| 🟠 HIGH | `worker/tasks/[id]` PATCH — IDOR-write cross-worker | ✅ FIXED (c5ec6ef) |
| 🟠 MED | `cron/poll-geminigen` — tidak fail-closed | ✅ FIXED (c5ec6ef) |
| 🟡 MED | timing-safe compare (3 internal route) | ✅ FIXED (c5ec6ef) |
| 🟡 MED | `internal/*` broad — 1 WORKER_API_KEY = semua user data | **NEEDS DECISION** |
| 🟡 MED | `internal/worker/events` — unbounded LLM spend (DoS) | **NEEDS DECISION** |
| 🟡 LOW | `content-log` — write-side cross-tenant tagging | DEFERRED |
| 🟢 LOW | error leakage `String(err)` di cron/admin response | DEFERRED |

**Yang TERBUKTI AMAN (no action):** semua `/api/admin/*` (77 route, owner-filtered), `/api/hermes/*` read-path (assignment-scoped), `/api/gen/*` (user-scoped), token encryption (AES-256-GCM, IV per-encrypt, fail-loud prod), SQL injection (zero raw-unsafe), path traversal di `photos/serve` (resolved-root check solid), `capi/events` (rate-limited + unguessable configId), webhook geminigen/data-deletion (timing-safe HMAC). Tidak ada token/hash bocor di response mana pun.

---

## FIXED (commit c5ec6ef) — deployed

### 1. `internal/feature-flags/check` — ZERO auth → WORKER_API_KEY
**Sebelum:** komentar ngaku "internal only" tapi NOL enforcement. Siapapun di internet bisa baca flag `config` JSON via query param.
**Fix:** tambah `validateApiKey(req)` (timing-safe, shared helper).
**⚠️ CALLER ACTION:** VPS worker yang panggil endpoint ini WAJIB kirim header `x-api-key: <WORKER_API_KEY>`. Kalau caller belum kirim → flag check balik 401 → fitur (mis. `creative_topup`) bisa diam-diam mati. **Verify dulu caller-nya** (worker pakai key yang sama dengan internal/actions, harusnya sudah kirim).

### 2. `worker/tasks/[id]` PATCH — IDOR-write
**Sebelum:** `findUnique({id})` tanpa cek ownership → worker A bisa ubah status/result task worker B.
**Fix:** kalau auth via worker key, enforce `task.workerId === agent.id`. Admin session (tanpa x-api-key) tetap override semua.

### 3. `cron/poll-geminigen` — fail-closed
**Sebelum:** `secret !== process.env.CRON_SECRET` tanpa guard env kosong → kalau CRON_SECRET unset, `undefined !== undefined` = false → auth lolos.
**Fix:** `if (!expected || secret !== expected) return 401`.

### 4. Timing-safe compare — metrics/batch, monitor/sessions, worker/events
**Sebelum:** plaintext `apiKey === process.env.WORKER_API_KEY` (timing oracle).
**Fix:** pakai shared `validateApiKey` (`timingSafeEqual`) dari `internal/_lib/api-key-auth`.

---

## NEEDS DECISION — tidak di-auto-fix (nyangkut arsitektur)

### A. 🔴 `worker/tokens/[metaConnectionId]` — raw Meta token, no scope binding
**File:** `src/app/api/worker/tokens/[metaConnectionId]/route.ts`
**Masalah:** `findUnique({where:{id:metaConnectionId}})` lalu `decode()` → return **long-lived Meta token plaintext** untuk metaConnectionId APAPUN. Tidak ada binding ke account yang di-assign ke worker. Satu worker key + enumerate cuid = panen SEMUA token Meta semua user. Ini exposure paling sensitif di sistem.

**Kenapa tidak gue auto-fix:** worker memang BUTUH token ini buat call Meta API (posting, ads). Nge-scope sembarangan bisa mematikan worker. Butuh keputusan lo:

- **Opsi 1 (scope-bind):** worker hanya boleh ambil token untuk account yang di-assign ke worker itu (perlu model assignment MetaAccount→worker). Paling aman, perlu effort.
- **Opsi 2 (proxy):** worker tidak pernah pegang raw token — semua call Meta di-proxy lewat HSL. Paling aman, effort besar (refactor worker).
- **Opsi 3 (accept + harden):** terima risiko, tapi (a) rotate WORKER_API_KEY rutin, (b) network-restrict endpoint ke IP worker, (c) audit-log tiap akses token. Effort kecil.

### B. 🟡 `internal/*` — broad shared-key trust (no tenant scope)
**Masalah:** semua `internal/*` route pakai 1 `WORKER_API_KEY` shared, query `findUnique({id})` tanpa predikat `userId`. Kalau key bocor = baca/mutate data semua user (actions, generated-media refund, campaign sync, dll). Counter-example yang BENAR: `internal/meta-entities/upsert` validasi `session.userId == body.userId`.
**Decision:** ini memang trust-model "worker internal tepercaya". Pilihan: (a) terima + rotate/network-restrict key (sama Opsi 3 di atas), atau (b) tambah binding userId per-call (effort besar, banyak route).

### C. 🟡 `internal/worker/events` — unbounded LLM spend
**Masalah:** tiap POST trigger `runSaasResponder` (LLM call) fire-and-forget, tanpa rate limit. Caller dengan key bisa spam → biaya LLM membengkak.
**Decision:** tambah rate limit / dedup per subjectId, atau queue. Perlu lo tentuin batas.

---

## DEFERRED — low, catat saja

- **`content-log` POST** (`src/app/api/hermes/content-log/route.ts:67-85`): `topicId/cepId/productId/characterId` dari body ditulis tanpa assignment check. Write-side tagging, bukan read leak. Fix: mirror verifikasi assignment dari `cep-feedback`. Low blast radius.
- **Error leakage:** `String(err)` / `e.message` ke client di ~11 lokasi cron/admin (semua auth-gated). Bisa bocorkan path/stack internal, bukan secret. Fix: generic message + log server-side.
- **`webhooks/telegram` & `geminigen`:** secret optional (`if(expected)`) — kalau env unset, no auth. Pastikan `TELEGRAM_WEBHOOK_SECRET` & webhook secret ke-set di Railway.

---

## Rekomendasi Urutan
1. **Verify caller feature-flags** kirim x-api-key (cek jangan sampai fitur mati).
2. **Putuskan worker/tokens** (Opsi 1/2/3) — exposure tertinggi.
3. Putuskan internal broad-scope (B) + worker/events rate limit (C).
4. Deferred kapan-kapan.
