# Blueprint: Zero-Worker — Semua Operasi Direct (SaaS)

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION
**Auditor:** Fable 5 · **Executor:** Sonnet (VPS)
**Estimasi:** 60–90 menit (besar, money-sensitive)

> Prinsip: **TIDAK ADA satu pun pekerjaan yang butuh worker.** Semua eksekusi langsung
> in-request / in-cron, sync (sukses atau gagal saat itu juga). Fungsi TETAP, cuma cara
> eksekusi berubah dari "enqueue WorkerTask → worker" jadi "panggil Meta API langsung".
> Pola sudah mapan di `src/app/api/admin/campaign-sessions/[id]/topup/run/route.ts` +
> `cron/topup-campaigns` (token via getMetaToken/decode → `canWriteToAdAccount` guard →
> `createAd` → `markAccountHealthy`/`markAccountNeedsReconnect`). TIRU pola itu.

---

## ATURAN WAJIB
- Baca tiap file + payloadJson producer SEBELUM rewire — replikasi maksud task aslinya persis.
- Baca `prisma/schema.prisma` sebelum pakai field. Field gak ada → STOP/DEFERRED, jangan tebak.
- **SEMUA campaign/adset/ad dibuat status `PAUSED`** — jangan auto-spend. Aktivasi manual oleh admin.
- Tiap operasi Meta: WAJIB lewat `canWriteToAdAccount` guard + token via `getMetaToken`. Error → `markAccountNeedsReconnect` kalau token, generic message ke client (jangan bocor).
- **AutomationAction TETAP ADA** (ledger/Action Center, dipakai cron hidup). Cuma: hapus WorkerTask berpasangan, eksekusi inline, set status SUCCEEDED/FAILED + executedAt + metaResponseJson.
- Cron/endpoint TIDAK boleh throw karena 1 item gagal — per-item try/catch, catat error, lanjut.
- tsc --noEmit + `npm run build` WAJIB lulus tiap phase (selain `driver.js` pre-existing).
- DILARANG force-push. Commit per phase. git pull --rebase kalau ketolak.
- Smoke test tiap fitur (lihat PHASE 6). Error → self-refine sesuai fungsi sampai jalan.

---

## PHASE 0 — Helper Meta baru (`src/lib/meta-client.ts`)

Saat ini ada `createAd`, `setStatus`, `updateBudget`, `uploadImageToMeta`, `metaPost`/`metaGet`, `resolvePageId`. **Belum ada** create campaign & adset. Tambah, mirror gaya `createAd` (retry + RateLimitError/TokenError handling via `metaPost`):

```ts
// POST /act_{adAccountId}/campaigns
export async function createCampaign(adAccountId: string, spec: {
  name: string; objective: string; status?: 'PAUSED' | 'ACTIVE';
  specialAdCategories?: string[]; // default []
}, token: string): Promise<{ id: string }> {
  const body: Record<string,string> = {
    name: spec.name,
    objective: spec.objective,
    status: spec.status ?? 'PAUSED',
    special_ad_categories: JSON.stringify(spec.specialAdCategories ?? []),
  }
  const res = await metaPost(`act_${adAccountId}/campaigns`, token, body)
  return { id: res.id }
}

// POST /act_{adAccountId}/adsets
export async function createAdset(adAccountId: string, spec: {
  name: string; campaignId: string; dailyBudgetMinor?: number;
  optimizationGoal: string; billingEvent: string; bidStrategy?: string;
  targetingJson: string; status?: 'PAUSED' | 'ACTIVE';
  startTime?: string; // ISO
}, token: string): Promise<{ id: string }> {
  const body: Record<string,string> = {
    name: spec.name,
    campaign_id: spec.campaignId,
    optimization_goal: spec.optimizationGoal,
    billing_event: spec.billingEvent,
    targeting: spec.targetingJson,
    status: spec.status ?? 'PAUSED',
    ...(spec.dailyBudgetMinor ? { daily_budget: String(spec.dailyBudgetMinor) } : {}),
    ...(spec.bidStrategy ? { bid_strategy: spec.bidStrategy } : {}),
    ...(spec.startTime ? { start_time: spec.startTime } : {}),
  }
  const res = await metaPost(`act_${adAccountId}/adsets`, token, body)
  return { id: res.id }
}
```
Cek field exact yang dibutuhin dari payloadJson producer (#1/#5) — sesuaikan param. Kalau objective/optimization_goal dll ada di payload lama, pakai itu.

---

## PHASE 1 — Rewire ringan (no campaign spend, low risk)

Pola umum tiap endpoint: hapus `workerTask.create`, ganti panggilan langsung pakai `getMetaToken` + `graphFetch`/`metaPost`, update record jadi status final (READY/dll) + simpan id Meta, return hasil sync. Bungkus try/catch → error generic + status FAILED di record.

### #3 `admin/meta-catalogs/route.ts` — create_catalog
Baca payload lama. Direct: `graphFetch('POST', \`${businessId}/owned_product_catalogs\`, token, { name })` → simpan `metaCatalog.metaCatalogId` + status `READY`. (Catalog creation gratis, aman.)

### #4 `admin/meta-catalogs/[id]/route.ts` — create_product_set
Direct: `POST /{catalogId}/product_sets` body `{ name, filter? }` → update `metaProductSet` + status READY.

### #7 `admin/meta-audiences/route.ts` — create custom/lookalike
- custom: `POST /act_{adAccountId}/customaudiences` `{ name, subtype, description, customer_file_source, rule? }`
- lookalike: `POST /act_{adAccountId}/customaudiences` `{ name, subtype:'LOOKALIKE', origin_audience_id, lookalike_spec }`
→ update `metaAudience.metaAudienceId` + status READY.

### #8 `admin/meta-audiences/[id]/route.ts` — delete_custom_audience
Saat record di-delete: `graphFetch('DELETE', \`${audienceMetaId}\`, token)` langsung sebelum/sesudah hapus row. Gagal di Meta (mis. udah kehapus) → log + lanjut hapus row lokal.

**Commit:** `feat(direct): catalog/product-set/audience ops run direct via Graph API (no worker)`

---

## PHASE 2 — Rewire berat (LIVE Meta writes — semua PAUSED)

### #5 `admin/campaign-sessions/route.ts` — CREATE_CAMPAIGN
Saat ini: bikin session + AutomationAction PENDING + WorkerTask. Ganti:
1. Bikin session (tetap).
2. Bikin AutomationAction (source SYSTEM, actionType CREATE_CAMPAIGN, status PENDING, idempotencyKey).
3. **Eksekusi langsung**: `createCampaign(adAccountId, { name, objective, status:'PAUSED', ... }, token)` (guard + token).
4. Update AutomationAction: status SUCCEEDED, executedAt=now, metaResponseJson, targetMetaEntityId=campaign.id. Simpan `metaCampaignId` ke session.
5. Gagal → AutomationAction FAILED + errorMessage; return error generic.
HAPUS `workerTask.create`.

### #1 `admin/approval-requests/[id]/route.ts` — create_full_launch_v3
Saat approve TestLaunch: bangun full funnel LANGSUNG (semua PAUSED):
1. `createCampaign` → campaignId
2. `createAdset` (targeting/budget/optimization dari TestLaunch payload) → adsetId
3. Loop creative → `createAd` (pola persis topup/run: `resolvePoolMediaUrl` → `createAd`) → adIds
4. Simpan id ke record (TestLaunch/CampaignSession), set approval SUCCEEDED.
Gagal di tengah → rollback sebisanya (pause/log apa yang udah kebuat) + status FAILED + errorMessage. JANGAN biarin setengah jalan tanpa jejak.
HAPUS `workerTask.create`. Baca payload `create_full_launch_v3` lama buat tau struktur funnel.

### #6 `admin/campaign-sessions/[id]/actions/route.ts` — generic dispatcher
Map `actionType` → helper direct, eksekusi inline, set AutomationAction status:
| actionType | helper |
|---|---|
| PAUSE_CAMPAIGN/ADSET, RESUME_* | `setStatus(entityId, 'PAUSED'|'ACTIVE', token)` |
| UPDATE_BUDGET | `updateBudget(entityId, minor, token, level)` |
| CREATE_CAMPAIGN | `createCampaign` |
| CREATE_AD/REPLACE_AD/ADD_CREATIVE | `createAd` |
| NOTIFY | kirim notify (src/lib/notify.ts), no Meta write |
Tiap: guard + token → eksekusi → AutomationAction SUCCEEDED/FAILED + metaResponseJson. actionType gak dikenal → FAILED "unsupported". HAPUS `workerTask.create`.

**Commit:** `feat(direct): campaign/adset/funnel/actions execute direct on Meta (PAUSED, no worker)`

---

## PHASE 3 — Hapus retry (no retry — sync only)

### #2 `admin/dead-letters/retry/[id]/route.ts`
Hapus endpoint retry (konsep retry→worker usang; SaaS gak ada retry async). Hapus juga tombol/aksi retry di UI yang manggil endpoint ini (cek `src/app/**` yang fetch `dead-letters/retry`). DeadLetterEntry sebagai log error boleh tetap (read-only di observability). Cek apakah masih ada PRODUCER DeadLetterEntry selain worker — kalau worker-only, producer-nya udah ilang, jadi tabel jadi historis (biarin, jangan drop).

**Commit:** `chore(direct): remove async retry endpoint (SaaS executes sync, no requeue)`

---

## PHASE 4 — Sapu bersih sisa WorkerTask

```bash
grep -rn "workerTask\|WorkerTask" src/ --include="*.ts" --include="*.tsx"
```
- Producer apa pun yang tersisa → rewire direct atau hapus.
- `admin/worker-tasks/route.ts` + `observability/queue` + `observability/workers` (baca WorkerTask/WorkerRegistry buat dashboard) → karena producer ilang, ini jadi nampilin data historis/kosong. Boleh: (a) biarin (nampil kosong), atau (b) hapus tab/endpoint observability worker biar UI bersih. **Pilih hapus tab worker observability** biar konsisten "no worker" — tapi JANGAN drop tabel.
- Tujuan akhir: `grep workerTask.create` di seluruh `src/` = **0**.

**Commit:** `chore(direct): purge remaining worker-task producers + worker observability tab`

---

## PHASE 5 — Docs

- In-app `src/app/docs/page.tsx`: hapus/ralat bagian yang nyebut worker/task-queue. Pastikan flow generate + launch dijelasin sebagai direct.
- `docs/`: update yang relevan. Tambah catatan arsitektur: "HSL zero-worker — semua operasi direct/SaaS."
- Update `CLAUDE.md` bagian arsitektur kalau nyebut worker.

**Commit:** `docs: reflect zero-worker direct architecture`

---

## PHASE 6 — Smoke Test (WAJIB tiap fitur) + Self-Refine

Test pakai data nyata seminimal mungkin, **campaign selalu PAUSED** (no spend). Untuk tiap fitur yang di-rewire:
1. **Catalog (#3/#4):** buat catalog + product set via endpoint → cek 200 + `metaCatalogId` keisi + status READY. (Gratis.)
2. **Audience (#7/#8):** buat custom audience kecil → cek READY + metaAudienceId; lalu delete → cek kehapus di Meta. (Gratis.)
3. **Campaign (#5):** buat campaign PAUSED → cek metaCampaignId keisi, AutomationAction SUCCEEDED, di Meta statusnya PAUSED. (No spend.)
4. **Full launch (#1):** approve 1 TestLaunch dummy → cek campaign+adset+ad kebuat PAUSED, semua id kesimpan, approval SUCCEEDED.
5. **Actions (#6):** PAUSE/RESUME/UPDATE_BUDGET ke entity PAUSED → cek AutomationAction SUCCEEDED + perubahan kebaca di Meta.

Tiap test GAGAL → diagnosa (symptom → hipotesis → fix) → ulang sampai PASS. Catat hasil tiap fitur di report (PASS/FAIL + bukti).
Kalau butuh kredensial/akun Meta test yang gak tersedia → tandai SMOKE-DEFERRED di report dengan alasan, jangan dipaksa.

---

## PHASE 7 — Report `docs/zero-worker-report.md`
- Tabel 8 producer: file | dulu (worker) | sekarang (direct helper) | status (DONE/DEFERRED) | commit
- Helper baru: createCampaign/createAdset
- Smoke test: tabel fitur | PASS/FAIL/DEFERRED | bukti
- `grep workerTask.create src/` = 0 ✓
- Sisa risiko + ACTION untuk Boy (mis. perlu re-activate campaign manual, env, dll)
- tsc/build status

Kirim ke Boy: ringkasan DONE vs DEFERRED + commit hashes + hasil smoke test + grep workerTask = 0 confirm.
