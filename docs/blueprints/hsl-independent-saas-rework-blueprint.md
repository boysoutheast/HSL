# Blueprint: HSL Independent SaaS — Rework End-to-End (Direct Meta API, No Worker)

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION (Sonnet VPS)
**Estimasi:** 5–7 jam · **Skala target:** 2000 user
**Tujuan:** HSL berdiri sendiri sebagai SaaS — semua operasi Meta **direct API dari HSL**, ZERO ketergantungan Hermes worker. Hapus semua surface worker/agent. Fitur wajib patuh dokumentasi Meta Graph API v25.0, dibuktikan smoke test.

---

## 1. Prinsip Rework

- **HSL self-contained.** Background work = Railway Cron → HSL internal route → direct Meta call. BUKAN worker polling.
- **"Direct API" ≠ tanpa engine.** Tetep butuh scheduler (cron) + batching (chunk per invocation) + rate-limit handling. Bedanya: HSL yang OWN, bukan agent eksternal.
- **Fungsi gak bias.** Sync / scan-eval / apply / top-up kepisah jelas, masing-masing 1 tanggung jawab.
- **Meta compliance.** Tiap call ikut spec Graph API v25.0 (endpoint, field, enum, unit budget). Smoke test wajib di account allowlist, mode PAUSED.
- **Future (bukan sekarang):** "duplicate campaign ke ad account lain" = bulk op, nanti boleh pakai Hermes. JANGAN dibangun di rework ini.

---

## 2. FASE A — DELETE (bersihin surface worker/agent)

Hapus total. Cek dulu gak ada import nyangkut (tsc bakal nangkep).

### A1. Halaman + komponen
```
HAPUS:
  src/app/workers/                       (+ semua isinya)
  src/app/observability/
  src/app/admin/dead-letters/
  src/app/system/CpasTab.tsx
```

### A2. System page tabs
`src/app/system/page.tsx` — buang tab `workers`, `dead-letters`, `observability`, `cpas`.
```
adminTabs JADI: connections, users
userTabs  TETAP: connections
```
Hapus import WorkersPage/DeadLettersPage/ObservabilityPage/CpasTab + panel-nya.

### A3. Docs tabs
`src/app/docs/page.tsx` — hapus tab `workers` + `cpas` (dari TabKey type + array tabs + blok render). Sisakan: connect, generate, credits, library, content, capi, admin, campaigns.

### A4. CPAS endpoints (semua)
```
HAPUS:
  src/app/api/admin/cpas/         (pain-library, graveyard)
  src/app/api/hermes/cpas/        (slot-count, pain-library, graveyard, lessons, diary, spawn-job)
```
⚠️ Cek schema: model CpasGraveyard/CpasDiary/CpasLesson/CpasPainEntry — **JANGAN drop tabel** (data + bisa dipakai nanti). Cukup hapus endpoint + UI. Migration kosong, tabel dibiarkan.

### A5. Sidebar / nav
Cek `src/components/Sidebar.tsx` + nav-badges — pastikan gak ada link/badge ke workers/observability/dead-letters/cpas. (Pillar utama udah Dashboard/Ads/Accounts/Studio/System — aman, tapi verify.)

### A6. Worker-facing endpoints — STATUS
JANGAN hapus dulu (dipakai gen video + jadi shared logic). Yang berubah: **gak ada worker yang manggil**. Cron HSL yang ambil alih (FASE C). Endpoint `/api/internal/worker/*`, `/api/worker/*` dibiarkan idle — boleh dihapus di fase lanjutan setelah video-gen juga di-direct-kan (OUT OF SCOPE sekarang).

---

## 3. FASE B — Fondasi: Meta client + Rule engine

### B1. `src/lib/meta-client.ts` — client Meta terpusat
Semua call Meta lewat sini. WAJIB patuh Graph API v25.0.
```ts
const GRAPH = 'https://graph.facebook.com/v25.0'

// Auth: Authorization: Bearer header (BUKAN access_token di URL — token jgn bocor ke log)
// Fungsi inti:
metaGet(path, token, params?)        // GET dengan retry + backoff
metaPost(path, token, body)          // POST (write) dengan retry
// Rate-limit handling:
//  - Baca header X-Business-Use-Case-Usage / X-App-Usage
//  - Kalau usage > 90% atau error code 17/4/32/613 (rate limit) → exponential backoff + retry (max 3)
//  - Error 190 (token invalid) → throw TokenError (caller mark sync_failed / reconnect)
// Helper spesifik:
getCampaignStructure(adAccountId, campaignId, token)  // campaign + adsets + ads
getInsights(entityId, token, datePreset)              // spend, actions, purchase_roas, cpc, ctr, impressions
updateBudget(entityId, dailyBudgetMinor, token)       // PATCH daily_budget (UNIT: minor/cents — IDR no decimal, tetap kirim integer rupiah)
setStatus(entityId, status, token)                    // PAUSED | ACTIVE
createAd(adsetId, creativeSpec, token)                // creative + ad (publisher_platforms eksplisit kalau override)
```
⚠️ **Meta compliance checklist** (taruh komentar di file):
- Budget unit: Meta pakai minor currency unit. IDR = zero-decimal → kirim nilai rupiah bulat sebagai integer. Verifikasi vs docs saat smoke.
- Status enum: hanya `ACTIVE`/`PAUSED` (campaign/adset/ad). Bukan lowercase.
- `publisher_platforms` wajib eksplisit kalau bikin/ubah placement (omit = Meta default semua platform → error 4399008).
- Insight `purchase_roas` = array `[{action_type, value}]` — parse hati-hati.
- Pagination: `getCampaignStructure` follow `paging.next` kalau ads > limit.

### B2. `src/lib/rule-engine.ts` — evaluator condition tree
Pindah logika eval dari rencana worker ke HSL.
```ts
// Input: conditionTreeJson (parsed) + metrics object
// Tree: { op: 'AND'|'OR'|'NOT', children: [...] } | { metric, operator, value }
// operator: gt|gte|lt|lte|eq|ne
// metric: spend|roas|cpc|ctr|purchases|impressions (dari MetricSnapshot)
evaluateRule(conditionTree, metrics): { matched: boolean, resultJson: {...actual values per leaf} }
// actionSpecJson → { actionType, mode?, amount? }
resolveAction(actionSpec, currentBudget?): { actionType, payload }  // mis. increase_pct 20 → newBudget
```
Unit test (jest/vitest atau script): AND/OR/NOT nested + tiap operator + edge null metric.

---

## 4. FASE C — Cron-driven direct execution

3 cron baru. Semua: auth `x-cron-secret`, batched (chunk), throttled, base URL `https://ai.boytenggara.com`.

### C1. `POST /api/cron/sync-campaigns`
Ganti dispatch WorkerTask di import route.
```
1. Ambil CampaignSession importStatus IN ('pending_sync', null) AND source='imported', LIMIT 20
2. Per session: token (decrypt) → meta-client.getCampaignStructure
3. Upsert MetaEntity (pakai logika meta-entities/upsert, jadiin shared fn)
4. Update dailyBudget + importStatus='synced' (atau 'sync_failed' on error)
5. Return { synced, failed }
Cron schedule: */5 * * * *
```
⚠️ Ubah `import/route.ts`: HAPUS `prisma.workerTask.create(...)` + `automationAction NOTIFY`. Cukup set importStatus='pending_sync' → cron yang sync.

### C2. `POST /api/cron/scan-campaigns`
Inti automation. Batched.
```
1. CampaignSession WHERE status=RUNNING AND automationEnabled=true AND (nextMonitorAt<=now OR null), LIMIT 30
2. Per session:
   a. token → getInsights per MetaEntity (campaign/adset/ad)
   b. Simpan MetricSnapshot
   c. Load AutomationRule ACTIVE (priority asc)
   d. Per rule: cek cooldown (now-lastFiredAt<cooldown → skip), maxFireCount, minimumDataAge
   e. evaluateRule(conditionTree, metrics)
   f. Catat RuleExecution (matched + resultJson + deduplicationKey)
   g. Kalau matched: APPLY LANGSUNG ke Meta (meta-client) — UPDATE_BUDGET / PAUSE_ADSET / dst
      - SAFETY: allowlist ad account (env HERMES_WORKER_WRITE_ALLOWED_AD_ACCOUNTS dipertahankan namanya
        atau rename ke HSL_WRITE_ALLOWED_AD_ACCOUNTS). Account di luar → skip + log.
      - Catat AutomationAction status SUCCEEDED/FAILED (executedAt/confirmedAt/metaResponseJson)
      - Update rule.lastFiredAt + fireCount
   h. Update nextMonitorAt = now + monitorIntervalMinutes
3. Return { scanned, rulesFired, actionsApplied }
Cron schedule: */5 * * * *  (per-session gating via nextMonitorAt bikin interval efektif = monitorIntervalMinutes)
```
⚠️ **Throttle 2000 user:** LIMIT 30/invocation + per-session token reuse. Kalau backlog, cron berikutnya lanjut (nextMonitorAt natural queue). Hormati Meta rate-limit via meta-client backoff.

### C3. `POST /api/cron/topup-campaigns`
Floor top-up direct.
```
1. CampaignSession WHERE topupEnabled=true AND minActiveAds>0, LIMIT 30
2. Per session:
   a. Hitung active AD (MetaEntity effectiveStatus=ACTIVE) — atau re-fetch dari Meta utk akurasi
   b. inflight = count AutomationAction CREATE_AD PENDING (cegah overshoot — logika MVP2 dipertahankan)
   c. need = max(0, minActiveAds - activeAds - inflight). need<=0 → skip
   d. Loop need: atomic claim pool (conditional updateMany status='available'→'used')
   e. Per claim: createAd LANGSUNG ke Meta (meta-client.createAd dgn pool copy)
      - Sukses: pool usedMetaAdId, topup-log succeeded, AutomationAction (kalau dibikin) SUCCEEDED
      - Gagal: pool balik available/failed (cek errorCode), topup-log failed
   f. Pool habis saat butuh → NOTIFY (cooldown 60m, Telegram opsional / in-app)
3. Return { topped, created, poolEmpty }
Cron schedule: */10 * * * *
```

### C4. Refactor: shared logic
Endpoint internal yang udah ada (`topup-claim`, `meta-entities/upsert`, `sync-status`, `actions/[id]`) → ekstrak logika ke `src/lib/` fn supaya cron + endpoint dua-duanya pake (DRY). Endpoint internal boleh tetap ada (debug/manual trigger), tapi cron gak HTTP-call diri sendiri — panggil fn langsung.

---

## 5. FASE D — Meta Compliance Smoke Test (WAJIB sebelum DONE)

Tiap operasi dibuktikan ikut docs Meta. Account allowlist Glazingskin `630941492644584`, mode aman (PAUSED).

| # | Operasi | Smoke | Expected (per Meta docs) |
|---|---|---|---|
| S1 | getCampaignStructure | Sync 1 campaign real | campaign+adset+ad kebaca, dailyBudget match Ads Manager |
| S2 | getInsights | Fetch insight campaign | spend/roas/ctr ada, format sesuai |
| S3 | updateBudget | Naikin budget adset PAUSED | Ads Manager nunjukin budget baru, unit bener |
| S4 | setStatus PAUSE | Pause adset | effective_status jadi PAUSED |
| S5 | createAd | Bikin ad dari pool, PAUSED | ad muncul di adset, status PAUSED, creative bener |
| S6 | rate-limit | Trigger banyak call | backoff jalan, gak error 17/4 fatal |
| S7 | rule end-to-end | roas>0 → budget+10% di session test | RuleExecution matched + AutomationAction SUCCEEDED + budget naik |
| S8 | top-up end-to-end | floor=N, active<N → createAd | pool used + ad PAUSED kebuat + log succeeded |

Bukti tiap step: response Meta (redact token) + readback dari Ads Manager / GET entity. Tulis di laporan.

---

## 6. FASE E — Update Docs + tsc

- `/docs`: hapus tab workers/cpas (FASE A3). Update tab campaigns: jelasin automation jalan via cron HSL (white-label, jangan sebut worker/Hermes ke customer surface).
- Hapus referensi worker dari docs admin tab.
- `tsc --noEmit` → 0 error.

---

## 7. Acceptance Criteria

- [ ] Halaman workers/observability/dead-letters + CpasTab terhapus, gak ada import nyangkut (tsc clean)
- [ ] System tabs: admin=connections+users, user=connections. Docs: tanpa workers/cpas
- [ ] CPAS endpoint terhapus, tabel TIDAK di-drop (data aman)
- [ ] meta-client.ts: Bearer header, rate-limit backoff, retry, unit budget bener
- [ ] rule-engine.ts: evaluator + unit test pass
- [ ] 3 cron (sync/scan/topup) jalan batched + throttled, ZERO WorkerTask dispatch
- [ ] import/route.ts: gak ada workerTask.create lagi
- [ ] Floor overshoot guard (inflight) dipertahankan di topup cron
- [ ] Allowlist guard di scan + topup (account non-allowlist di-skip)
- [ ] Smoke S1–S8 PASS di account allowlist, mode PAUSED, dengan bukti readback
- [ ] tenant isolation: semua query scoped userId (kecuali cron yang system-wide tapi tetap per-session-owner saat apply)
- [ ] tsc 0 error · /docs updated

---

## 8. Execution Order
```
A. DELETE surface (pages, system tabs, docs tabs, cpas endpoints) → tsc cek import nyangkut
B. meta-client.ts + rule-engine.ts (+ unit test rule-engine)
C. Cron sync → scan → topup (refactor shared logic, hapus workerTask dispatch di import)
D. Railway cron config (3 cron baru — start command pakai https://ai.boytenggara.com + x-cron-secret)
E. Smoke S1–S8 di Glazingskin (PAUSED)
F. /docs update + tsc
G. Commit per fase, push branch feat/hsl-independent-rework. JANGAN merge — laporan buat audit Fable.
```

---

## 9. Format Laporan (buat audit Fable)
```
1. DELETE: file/folder kehapus + konfirmasi tsc gak ada import nyangkut + tabel CPAS utuh (gak di-drop)
2. meta-client.ts: ringkas fungsi + bukti Bearer header + mekanisme backoff (tunjuk baris)
3. rule-engine.ts: unit test output (operator + nested AND/OR/NOT pass)
4. 3 cron: per cron — file + batching limit + throttle + konfirmasi ZERO workerTask.create
5. import/route.ts: diff yang ngebuktiin workerTask dispatch dihapus
6. Allowlist guard: tunjuk baris di scan + topup
7. Floor overshoot: tunjuk inflight guard masih ada
8. Smoke S1–S8: tabel hasil + bukti readback (redact token) — yang gak bisa di-test live sebutin alasan
9. Isolation: konfirmasi apply selalu ke session milik owner-nya
10. tsc 0 error. Branch + commit count.
JANGAN merge — tunggu audit Fable.
```

## Aturan Wajib
- Migration (kalau ada): IF NOT EXISTS, @map snake_case, NO DEFAULT cuid(). TABEL CPAS JANGAN DI-DROP.
- Meta: v25.0, Bearer header, publisher_platforms eksplisit, status ACTIVE/PAUSED, budget unit integer rupiah.
- Token JANGAN ke log/response/commit. Ad baru/perubahan default mode AMAN (PAUSED) saat smoke.
- White-label: customer surface (docs/UI) jangan sebut worker/Hermes/provider.
- No force-push. Commit per fase. JANGAN claim DONE tanpa smoke S1–S8 + tsc clean.
```
