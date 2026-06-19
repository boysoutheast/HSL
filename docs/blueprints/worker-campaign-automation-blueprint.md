# Blueprint: Worker Campaign Automation — End-to-End (MVP1 + MVP2 live)

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION
**Target repo:** `boysoutheast/hermes-worker` (VPS Contabo, systemd `hermes-worker.service`)
**Plus:** 1 companion endpoint kecil di HSL (action confirm) — dikerjain DULU di HSL repo.
**Tujuan:** Nyambungin MVP1 (attach rules) + MVP2 (floor top-up) jadi LIVE — worker yang eksekusi ke Meta.

---

## 0. Yang sudah disediain HSL (worker tinggal panggil)

| Endpoint | Fungsi | Auth |
|---|---|---|
| `POST /api/internal/worker/tasks/claim` | Claim task (FOR UPDATE SKIP LOCKED), body `{workerId, mode, capabilities[], maxTasks}` | x-api-key |
| `POST /api/internal/worker/tasks/[id]/start` | Tandai task processing | x-api-key |
| `POST /api/internal/worker/tasks/[id]/complete` | `{workerId, status, result?, error?}` | x-api-key |
| `POST /api/internal/worker/tasks/[id]/renew` | Perpanjang lease | x-api-key |
| `POST /api/internal/worker/heartbeat` | Heartbeat registry | x-api-key |
| `GET /api/internal/monitor/sessions` | List session due scan (RUNNING+automationEnabled+nextMonitorAt due) | x-api-key |
| `GET /api/internal/monitor/sessions/[id]/rules` | ACTIVE rules buat di-evaluate | x-api-key |
| `PATCH /api/internal/monitor/sessions/[id]` | Update cadence `{lastMonitorAt, nextMonitorAt}` | x-api-key |
| `POST /api/internal/monitor/metrics/batch` | Push MetricSnapshot batch | x-api-key |
| `POST /api/internal/rules/executions` | Catat RuleExecution `{ruleId, ruleVersion, campaignSessionId, matched, conditionResultJson, reasonText, deduplicationKey, targetMetaEntityId?}` | x-api-key |
| `POST /api/internal/rules/actions` | Bikin AutomationAction dari rule `{ruleId, ruleExecutionId?, campaignSessionId, actionType, targetEntityType?, payloadJson?, priority?}` | x-api-key |
| `GET /api/internal/actions?campaignSessionId=&status=PENDING&actionType=` | List action PENDING buat di-apply | x-api-key |
| `POST /api/internal/campaign-sessions/[id]/topup-claim` | Atomic claim pool → bikin CREATE_AD action + log | x-api-key |
| `PATCH /api/internal/campaign-sessions/topup-log/[id]` | `{status:'succeeded'|'failed', usedMetaAdId?, failedReason?}` | x-api-key |
| `GET /api/worker/tokens/[metaConnectionId]` | Ambil Meta token (decrypted) | x-api-key |

Worker convention (carry dari memory): status **lowercase** (pending/processing/completed/failed), `worker_id` stabil `worker-{hostname}`, `instanceId` `{hostname}-{pid}`, META_API_VERSION **v25.0**, `WORKER_API_KEY` dari `/root/.hermes/worker/api_key.txt`, base URL WAJIB `https://ai.boytenggara.com`.

---

## PHASE 0 (HSL repo) — Companion endpoint: Action confirm

**GAP:** `/api/internal/actions` cuma GET+POST. Worker butuh tandai action SUCCEEDED/FAILED setelah apply ke Meta (UPDATE_BUDGET/PAUSE_ADSET/CREATE_AD). Topup-log PATCH handle pool, TAPI AutomationAction-nya sendiri gak ke-update.

Buat di HSL: `PATCH /api/internal/actions/[actionId]/route.ts`
```
Auth: validateApiKey (x-api-key)
Body: { status: 'SUCCEEDED'|'FAILED'|'UNCERTAIN', metaResponseJson?, errorCode?, errorMessage? }
Flow:
  1. Load action by id → 404 kalau gak ada
  2. Kalau status sudah SUCCEEDED/FAILED → 409 (idempoten, jgn re-apply)
  3. Update: status, executedAt=now (kalau belum), confirmedAt=now (kalau SUCCEEDED),
     metaResponseJson, errorCode, errorMessage
  4. Return { action }
```
Smoke: POST action → PATCH SUCCEEDED → GET cek status. Update `/docs` Admin tab.
Commit di HSL, push main. BARU lanjut worker repo.

---

## PHASE 1 (worker) — `sync_campaign_entities`

Worker task type baru. Dipanggil pas user import campaign (HSL bikin WorkerTask `sync_campaign_entities`, scope internal).

```
Handler(payload = { campaignSessionId, metaCampaignId, metaAdAccountId }):
  1. Ambil token: GET /api/worker/tokens/{metaAccountId}  (metaAccountId dari ad account → parent)
     (atau token udah di-resolve worker-side; ikut pola task lain)
  2. Meta Graph v25.0:
     GET act_{adAccountId}/campaigns?fields=id,name,status,daily_budget,objective
        &filtering=[{field:'id',operator:'IN',value:[metaCampaignId]}]
     GET {metaCampaignId}/adsets?fields=id,name,status,effective_status,daily_budget,optimization_goal
     GET {metaCampaignId}/ads?fields=id,name,status,effective_status,adset_id,creative{id}
  3. Upsert ke HSL jadi MetaEntity (entityType CAMPAIGN/ADSET/AD):
     - Pakai endpoint upsert MetaEntity. KALAU belum ada → buat di HSL:
       POST /api/internal/meta-entities/upsert  (lihat PHASE 1b)
     - Set parentMetaEntityId (adset→campaign, ad→adset), effectiveStatus, rawStateJson, lastSyncedAt
  4. Update CampaignSession: dailyBudget = campaign.daily_budget (atau sum adset utk ABO),
     importStatus = 'synced', metaCampaignId confirmed.
     → PATCH /api/internal/monitor/sessions/{id} ATAU endpoint baru (PHASE 1b).
  5. Task complete: POST /api/internal/worker/tasks/{taskId}/complete { status:'completed', result }
  6. Error → complete { status:'failed', error }, set importStatus='sync_failed'.
```

### PHASE 1b (HSL repo) — endpoint pendukung sync
HSL belum punya upsert MetaEntity dari worker + set importStatus. Buat:
- `POST /api/internal/meta-entities/upsert` — body `{ campaignSessionId, userId, metaAdAccountId, entities:[{entityType, metaEntityId, parentMetaEntityId?, name, configuredStatus?, effectiveStatus?, deliveryStatus?, rawStateJson?}] }`. Upsert by unique (metaAdAccountId, entityType, metaEntityId). Set lastSyncedAt.
- `PATCH /api/internal/campaign-sessions/[id]/sync-status` — body `{ importStatus, dailyBudget? }`.
(2 endpoint kecil, x-api-key, scoped via session lookup. Commit HSL dulu.)

---

## PHASE 2 (worker) — Scan loop: metrics + rule evaluation

Loop utama, jalan tiap ~1 menit (atau cron tick).

```
Tick:
  1. GET /api/internal/monitor/sessions?limit=10  → sessions due
  2. Per session:
     a. Ambil token (parent meta account)
     b. Tarik insights Meta per entity (campaign+adset+ad):
        GET {entityId}/insights?fields=spend,actions,purchase_roas,cpc,ctr,impressions
           &date_preset=last_7d  (atau window sesuai rule.evaluationWindowMinutes)
     c. POST /api/internal/monitor/metrics/batch  → simpan MetricSnapshot
     d. GET /api/internal/monitor/sessions/{id}/rules  → ACTIVE rules
     e. Per rule (urut priority asc):
        - Cek cooldown: kalau now - lastFiredAt < cooldownMinutes → skip
        - Cek minimumDataAgeMinutes / maxFireCount
        - EVALUATE conditionTreeJson lawan MetricSnapshot terbaru (lihat §2.1)
        - deduplicationKey = `{ruleId}_{targetEntityId}_{windowBucket}`
        - POST /api/internal/rules/executions { matched, conditionResultJson, reasonText, deduplicationKey, targetMetaEntityId }
        - Kalau matched:
            POST /api/internal/rules/actions { ruleId, ruleExecutionId, campaignSessionId,
              actionType (dari actionSpecJson), targetEntityType, payloadJson, priority }
     f. PATCH /api/internal/monitor/sessions/{id} { lastMonitorAt: now, nextMonitorAt: now + monitorIntervalMinutes }
  3. Heartbeat: POST /api/internal/worker/heartbeat
```

### §2.1 Condition Tree evaluator
`conditionTreeJson` shape (dari rule-readable.ts + builder):
```json
{ "op": "AND", "children": [
  { "metric": "roas", "operator": "gt", "value": 2 },
  { "metric": "spend", "operator": "gte", "value": 50000 }
]}
```
Evaluator rekursif: AND/OR/NOT node + leaf {metric, operator(gt/gte/lt/lte/eq/ne), value}. Metric diambil dari MetricSnapshot field (spend, roas, cpc, ctr, purchases, dll). Return {matched: bool, resultJson: per-leaf actual values}.

`actionSpecJson` shape:
```json
{ "actionType": "UPDATE_BUDGET", "mode": "increase_pct", "amount": 20 }
{ "actionType": "PAUSE_ADSET" }
```

---

## PHASE 3 (worker) — Apply actions ke Meta

Pisah dari scan (bisa loop sendiri / sesudah eval). Ambil action PENDING, apply, confirm.

```
ApplyTick:
  1. GET /api/internal/actions?status=PENDING&limit=20  (atau per session)
  2. Per action (urut priority asc), idempoten via action.id:
     a. Ambil token
     b. Switch actionType:
        UPDATE_BUDGET → POST {adsetId|campaignId} { daily_budget: newValue }
                        (mode increase_pct: baca current dari MetaEntity, hitung, JANGAN over cap)
        PAUSE_ADSET   → POST {adsetId} { status: 'PAUSED' }
        RESUME_ADSET  → POST {adsetId} { status: 'ACTIVE' }
        PAUSE_CAMPAIGN/RESUME_CAMPAIGN → idem level campaign
        CREATE_AD     → lihat PHASE 4 (top-up khusus)
        NOTIFY        → kirim Telegram (pool_exhausted dll), gak ke Meta
     c. Sukses → PATCH /api/internal/actions/{id} { status:'SUCCEEDED', metaResponseJson }
        Gagal  → PATCH /api/internal/actions/{id} { status:'FAILED', errorCode, errorMessage }
  3. SAFETY: write mode guard — hormati allowlist ad account (HERMES_WORKER_WRITE_ALLOWED_AD_ACCOUNTS).
     Account di luar allowlist → action FAILED 'not_in_allowlist', JANGAN apply.
```

---

## PHASE 4 (worker) — Floor top-up (MVP2 integration)

Dijalankan di dalam scan loop PHASE 2, per session yang `topupEnabled`.

```
Setelah eval rules + APPLY (ad mungkin baru ke-pause):
  1. POST /api/internal/campaign-sessions/{id}/topup-claim   (HSL hitung floor + atomic claim pool)
     → return { action:'created'|'skip'|'pool_empty', created, ... }
  2. Kalau created > 0: HSL sudah bikin AutomationAction CREATE_AD (PENDING) + CampaignTopupLog (pending)
  3. Worker GET /api/internal/actions?actionType=CREATE_AD&status=PENDING&campaignSessionId={id}
  4. Per CREATE_AD action, baca payloadJson { adsetId, primaryText, headline, description, callToAction, linkUrl, mediaAssetId/creativeUrl }:
     a. Resolve media: kalau mediaAssetId → ambil fileUrl HSL; kalau creativeUrl → langsung
        → ensure di Meta: POST /api/internal/meta-media/ensure (sudah ada) ATAU upload adimage/advideo
     b. Buat AdCreative di Meta (object_story_spec dgn page + ig identity dari session/adset)
     c. Buat Ad di adsetId (status PAUSED dulu sesuai mode aman, atau ACTIVE kalau owner mau langsung live)
     d. Sukses:
        PATCH /api/internal/actions/{actionId} { status:'SUCCEEDED', metaResponseJson:{adId} }
        PATCH /api/internal/campaign-sessions/topup-log/{logId} { status:'succeeded', usedMetaAdId:adId }
        (logId: cari CampaignTopupLog by automationActionId — sediain GET kalau perlu, PHASE 4b)
     e. Gagal:
        PATCH action { status:'FAILED', errorCode, errorMessage }
        PATCH topup-log { status:'failed', failedReason:errorCode }
        → HSL auto balikin pool creative ke available/failed (logika sudah ada di topup-log PATCH)
```

### PHASE 4b (HSL, opsional) — lookup log by action
Kalau worker susah map action→log: `GET /api/internal/campaign-sessions/topup-log?automationActionId=<id>` return `{ id }`. Kecil, x-api-key.

---

## Acceptance (end-to-end, live)

- [ ] Import campaign → worker sync → MetaEntity terisi, dailyBudget asli kebaca, importStatus='synced'
- [ ] Attach rule "roas>2 → budget +20%" → scan → MetricSnapshot kebuat → kondisi match → AutomationAction UPDATE_BUDGET → apply → budget naik di Meta → action SUCCEEDED
- [ ] Rule "spend>100k & purchases=0 → pause adset" → adset PAUSED di Meta
- [ ] Floor=3, ada adset ke-pause sampai active ad=2 → topup-claim → CREATE_AD dari pool → ad baru kebuat → pool 'used' → topup-log 'succeeded'
- [ ] Pool habis → NOTIFY Telegram sekali (cooldown 60m)
- [ ] Action gagal → FAILED + errorMessage, pool balik available (retryable)
- [ ] Allowlist guard: account non-allowlist → action FAILED, gak ke-apply
- [ ] Cooldown + dedup: rule gak fire 2× dalam cooldown window

---

## Execution Order

```
HSL repo (commit + push main dulu):
  P0.  PATCH /api/internal/actions/[actionId] (confirm) + /docs
  P1b. POST meta-entities/upsert + PATCH sync-status
  P4b. GET topup-log?automationActionId (opsional)

Worker repo (boysoutheast/hermes-worker):
  P1.  sync_campaign_entities handler
  P2.  scan loop: insights → metrics/batch → rules eval → executions + actions
  P2.1 condition tree evaluator (unit test: AND/OR/NOT + operator)
  P3.  apply actions (UPDATE_BUDGET/PAUSE/RESUME) + confirm + allowlist guard
  P4.  floor top-up: topup-claim → CREATE_AD apply → confirm + log
  Smoke: 1 campaign real (allowlist Glazingskin 630941492644584), PAUSED-mode dulu.
```

---

## Aturan Wajib
- Worker status lowercase. Base URL `https://ai.boytenggara.com` (jangan railway URL — 308).
- Token JANGAN ke log/commit. META_API_VERSION v25.0. `publisher_platforms` wajib eksplisit (omit = error 4399008).
- Write guard: hormati `HERMES_WORKER_ENABLE_WRITES` + allowlist ad account. Default ad baru PAUSED.
- Idempoten: action.id + idempotencyKey. JANGAN apply 2× (cek status PENDING dulu).
- No force-push. HSL companion endpoint commit dulu sebelum worker depend.
- JANGAN claim DONE tanpa smoke end-to-end (minimal 1 rule fire + 1 top-up di account allowlist, mode PAUSED).
