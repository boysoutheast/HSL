# Blueprint MVP 1 — Attach Rules ke Existing Campaign + Scan Budget

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION (Sonnet VPS)
**Estimasi:** 3–4 jam
**Tujuan:** User pilih campaign Meta yang sudah jalan → attach rule template yang sudah disetting → HSL scan tiap interval → naik/turunin budget atau pause sesuai rule.

---

## 0. Konteks Existing (JANGAN dibikin ulang — sudah ada)

| Komponen | Status | Lokasi |
|---|---|---|
| `AutomationRule` (conditionTreeJson, actionSpecJson, cooldown, evaluationWindow, campaignSessionId) | ✅ ada | schema |
| `RuleTemplate` (built-in + user, conditionTreeJson, actionSpecJson) | ✅ ada | schema |
| `CampaignSession` (monitorIntervalMinutes, nextMonitorAt, automationEnabled, metaCampaignId, adsetCap) | ✅ ada | schema |
| `MetaEntity` (mirror CAMPAIGN/ADSET/AD dari Meta) | ✅ ada | schema |
| `AutomationAction` (UPDATE_BUDGET, PAUSE_ADSET, dll) | ✅ ada | schema |
| Scan loop worker | ✅ ada | `GET /api/internal/monitor/sessions` |
| POST automation-rules (terima campaignSessionId) | ✅ ada | `/api/admin/automation-rules` |
| Rules list UI | ✅ ada | `/rules-editor`, `/rules-editor/builder` |
| Ads pillar tabs: Campaigns / Rules | ✅ ada | `src/app/ads/page.tsx` |

**GAP yang harus dikerjakan MVP1:**
- **G1.** Import existing Meta campaign → jadi `CampaignSession` (sekarang session cuma kebuat dari TestLaunch).
- **G2.** Instantiate `RuleTemplate` → `AutomationRule` yang ke-bind ke session (route `campaign-sessions/[id]/rules` masih STUB 1 baris).
- **G3.** UI: set scan interval per campaign + attach template + monitor status.

---

## 1. DB Changes

Migration: `prisma/migrations/20260615000001_mvp1_attach_rules/migration.sql`
(IF NOT EXISTS semua, NO DEFAULT cuid(), camelCase WAJIB @map snake_case)

```sql
-- CampaignSession: tandai source supaya bisa bedain campaign import vs launch
ALTER TABLE campaign_sessions
  ADD COLUMN IF NOT EXISTS source        TEXT NOT NULL DEFAULT 'launch',  -- 'launch' | 'imported'
  ADD COLUMN IF NOT EXISTS import_status TEXT;                            -- null | 'pending_sync' | 'synced' | 'sync_failed'

-- AutomationRule: link balik ke template asalnya (audit + "instantiated from")
ALTER TABLE automation_rules
  ADD COLUMN IF NOT EXISTS source_template_id TEXT;

CREATE INDEX IF NOT EXISTS idx_campaign_sessions_source ON campaign_sessions(source, status);
CREATE INDEX IF NOT EXISTS idx_automation_rules_template ON automation_rules(source_template_id);
```

Prisma schema — tambah:
```prisma
// model CampaignSession
source        String  @default("launch")  @map("source")
importStatus  String? @map("import_status")

// model AutomationRule
sourceTemplateId String? @map("source_template_id")
@@index([sourceTemplateId])
```

Jalankan: `npx prisma generate` setelah edit schema.

---

## 2. Endpoints

### 2.1 — Import existing Meta campaign (G1)

`GET /api/admin/meta-campaigns?metaAdAccountId=<id>`
Auth: `requireAuth`. List campaign LIVE dari Meta yang BELUM jadi CampaignSession.
- Dispatch worker task `fetch_meta_campaigns` (read-only) ATAU langsung query Meta lewat token. **Pilih: dispatch worker task** (token ada di worker side, konsisten dengan arsitektur). Return list `{ metaCampaignId, name, status, dailyBudget, objective, adsetCount, adCount }`.
- Fallback: kalau worker lambat, endpoint return `{ pending: true, taskId }` → UI poll.

`POST /api/admin/campaign-sessions/import`
Body: `{ metaAdAccountId, metaCampaignId, name, monitorIntervalMinutes?, productId? }`
Flow:
```
1. requireAuth → userId
2. Cek belum ada CampaignSession dgn metaCampaignId sama (unik per user) → 409 kalau dobel
3. Create CampaignSession {
     source: 'imported', importStatus: 'pending_sync',
     status: 'RUNNING', automationEnabled: false,  // OFF dulu sampai user attach rule
     metaCampaignId, metaAdAccountId, monitorIntervalMinutes: body ?? 15,
     name, productId (opsional — boleh null utk imported),
     dailyBudget: 0  // di-overwrite pas sync
   }
4. Create AutomationAction actionType='NOTIFY' source='SYSTEM'
   payload { kind: 'sync_campaign_entities', metaCampaignId }
   → worker tarik campaign+adset+ad jadi MetaEntity + dailyBudget asli
5. Return 201 { session }
```

⚠️ `productId` di CampaignSession sekarang **required** di schema. Untuk imported campaign yang gak punya produk HSL, buat opsi: (a) ubah jadi nullable via migration, ATAU (b) wajibkan user pilih produk pas import. **Pilih (a)** — productId jadi nullable:
```sql
ALTER TABLE campaign_sessions ALTER COLUMN product_id DROP NOT NULL;
```
Prisma: `productId String? @map("product_id")` + relasi `product Product?`.

### 2.2 — Instantiate template ke session (G2)

`POST /api/admin/campaign-sessions/[id]/rules`
(GANTI stub yang sekarang cuma 1 baris)
Body: `{ templateId, overrides?: { cooldownMinutes?, evaluationWindowMinutes?, priority? } }`
Flow:
```
1. requireAuth → cek session.userId === auth.id (404 kalau bukan punya dia)
2. Load RuleTemplate (built-in: userId null OK; user template: userId harus match)
3. Create AutomationRule {
     userId, campaignSessionId: id,
     name: template.name, scope: template.scope, ruleCategory: template.ruleCategory,
     conditionTreeJson: template.conditionTreeJson,  // copy as-is
     actionSpecJson: template.actionSpecJson,
     sourceTemplateId: templateId,
     cooldownMinutes: overrides.cooldownMinutes ?? 60,
     evaluationWindowMinutes: overrides.evaluationWindowMinutes ?? null,
     priority: overrides.priority ?? 5,
     status: 'ACTIVE'   // langsung aktif (beda dgn POST manual yg DRAFT)
   }
4. Increment template.usageCount
5. Return 201 { rule }
```

`GET /api/admin/campaign-sessions/[id]/rules` — list rules ter-attach ke session ini (include status, lastFiredAt, fireCount).

`DELETE /api/admin/campaign-sessions/[id]/rules/[ruleId]` — detach (set status ARCHIVED, jangan hard-delete — simpan history RuleExecution).

### 2.3 — Toggle automation + interval

`PATCH /api/admin/campaign-sessions/[id]`
Tambah field yang bisa di-update: `{ automationEnabled?, monitorIntervalMinutes? }`
- `monitorIntervalMinutes` valid range: 5–1440. Saat di-set, reset `nextMonitorAt = now` biar scan langsung jalan di siklus berikut.
- `automationEnabled=true` cuma boleh kalau session punya ≥1 AutomationRule status ACTIVE → else 422 "Attach minimal 1 rule dulu".

---

## 3. Scan Engine — sudah ada, pastikan ke-cover

Worker poll `GET /api/internal/monitor/sessions` (sudah ada, filter RUNNING + automationEnabled + nextMonitorAt due). Yang perlu DIPASTIKAN/ditambah:

- **Rule evaluation** harus jalan saat scan. Cek apakah worker sudah evaluate `AutomationRule.conditionTreeJson` lalu create `AutomationAction`. Kalau BELUM ada di worker repo (hermes-worker) → ini task TERPISAH di worker, sebut di handoff. HSL side cukup sediakan:
  - `GET /api/internal/monitor/sessions/[id]/rules` — worker ambil rules ACTIVE milik session buat di-evaluate.
  - `POST /api/internal/actions` — worker create AutomationAction hasil evaluasi (kalau belum ada).
- Setelah scan, worker WAJIB update `lastMonitorAt=now`, `nextMonitorAt=now + monitorIntervalMinutes`. Sediakan:
  `PATCH /api/internal/monitor/sessions/[id]` body `{ lastMonitorAt, nextMonitorAt }`.

**Budget naik/turun** = `AutomationAction.actionType='UPDATE_BUDGET'`, payload `{ targetMetaEntityId, newDailyBudget }`. Worker apply ke Meta. Ini sudah dalam enum — pastikan worker handle (handoff worker).

---

## 4. UI/UX — Ads → Campaigns

### 4.1 Campaign list (refine existing `/ads?tab=campaigns`)
Tambah di header list: tombol **"+ Import Campaign"** (selain "New Launch" yang sudah ada).

Tiap card campaign tampilkan badge baru:
- `🔵 Imported` / `🚀 Launch` (dari `source`)
- **Automation status**: toggle pill `Auto ON`/`Auto OFF` (warna hijau/abu) — klik = PATCH automationEnabled. Disabled + tooltip kalau belum ada rule.
- **Scan interval**: chip `⏱ tiap 15m` (klik → dropdown 5/10/15/30/60 menit).
- **Rules attached**: `⚙️ 2 rules` (klik → buka panel rules session).
- **Last scan**: `🔄 3m lalu` dari lastMonitorAt.

### 4.2 Import Campaign modal (BARU)
Step wizard 2 langkah:
```
Step 1 — Pilih Ad Account + Campaign
  - Dropdown Ad Account (dari MetaAdAccount user)
  - Loading → fetch GET /api/admin/meta-campaigns?metaAdAccountId=
  - List campaign (radio): nama, status Meta, daily budget, jumlah adset/ad
  - Yang sudah di-import: greyed + label "sudah dikelola"

Step 2 — Setting awal
  - Nama internal (prefill dari Meta campaign name, editable)
  - Scan interval (default 15m)
  - Info box: "Automation OFF dulu. Attach rule setelah import."
  - Tombol "Import & Sync"
→ POST /api/admin/campaign-sessions/import
→ Redirect ke detail campaign, tampil banner "Syncing entities..." sampai importStatus='synced'
```

### 4.3 Campaign detail — panel "Rules" (refine `/campaign-monitor/[id]`)
Section baru **"Automation Rules"**:
```
┌─ Automation Rules ──────────────────────── [+ Attach Template] ┐
│  ⚙️ Scale up winner          ACTIVE   fired 3×   last 1h lalu  │
│      IF roas > 2 AND spend > 50k  →  budget +20%      [detach] │
│  ⚙️ Kill loser               ACTIVE   fired 0×                 │
│      IF spend > 100k AND purchases = 0  →  pause adset[detach] │
└───────────────────────────────────────────────────────────────┘
```
- **"+ Attach Template"** → modal: list RuleTemplate (built-in + user). Tiap template tampil ringkasan kondisi+aksi (parse JSON jadi human-readable). Pilih → optional overrides (cooldown, window) → POST attach.
- Tiap rule row: status, fireCount, lastFiredAt, ringkasan kondisi→aksi (parse conditionTree/actionSpec), tombol detach.
- Human-readable parser: bikin helper `src/lib/rule-readable.ts` — input conditionTreeJson+actionSpecJson → string `"IF roas > 2 → budget +20%"`. Reusable di list + builder.

### 4.4 Scan activity feed (di detail campaign)
Timeline kecil dari RuleExecution + AutomationAction:
```
🔄 14:30  Scan — 2 rules evaluated, 1 matched
   ↳ ⬆️ Budget adset "Broad 25-45" 50k → 60k (UPDATE_BUDGET, SUCCEEDED)
🔄 14:15  Scan — 2 rules evaluated, 0 matched
```
Source: `GET /api/admin/campaign-sessions/[id]/actions` (sudah ada) + RuleExecution. Polling 30s.

---

## 5. Acceptance Criteria

- [ ] Import campaign Meta yang sudah jalan → muncul sebagai CampaignSession source='imported', entities ke-sync (MetaEntity terisi, dailyBudget asli kebaca)
- [ ] Attach RuleTemplate ke session → AutomationRule kebuat status ACTIVE, sourceTemplateId terisi, template.usageCount naik
- [ ] automationEnabled gak bisa ON tanpa rule (422)
- [ ] Set scan interval → nextMonitorAt reset, scan loop pick up sesuai interval
- [ ] Scan jalan → RuleExecution kebuat, kalau match → AutomationAction UPDATE_BUDGET/PAUSE kebuat
- [ ] UI: badge source, toggle auto, interval chip, rules panel, activity feed semua jalan
- [ ] Tenant isolation: user A gak bisa import/attach/lihat campaign user B (semua scoped userId)
- [ ] tsc --noEmit 0 error (file yang disentuh)
- [ ] Update `/docs` (src/app/docs/page.tsx) — tambah section import campaign + attach rules

---

## 6. Execution Order

```
1. Migration SQL + prisma schema (source, importStatus, sourceTemplateId, productId nullable) → prisma generate
2. GET /api/admin/meta-campaigns (list importable)
3. POST /api/admin/campaign-sessions/import
4. POST/GET/DELETE /api/admin/campaign-sessions/[id]/rules (ganti stub)
5. PATCH /api/admin/campaign-sessions/[id] (automationEnabled + interval guard)
6. Internal: GET sessions/[id]/rules + PATCH monitor cadence (kalau worker butuh)
7. src/lib/rule-readable.ts (parser kondisi→aksi)
8. UI: Import modal + campaign card badges
9. UI: detail panel Rules (attach/detach) + activity feed
10. Update /docs
11. tsc --noEmit → fix
12. Commit per fase, push. Smoke test.
```

---

## 7. Handoff ke Worker Repo (TERPISAH — boysoutheast/hermes-worker)

Sebut di laporan, JANGAN dikerjakan di HSL:
- Task `fetch_meta_campaigns` (read campaign list dari Meta)
- Task `sync_campaign_entities` (tarik campaign+adset+ad → POST balik ke HSL jadi MetaEntity)
- Rule evaluation engine (baca conditionTreeJson → bandingin MetricSnapshot → create AutomationAction)
- Apply `UPDATE_BUDGET` / `PAUSE_ADSET` ke Meta

---

## Aturan Wajib (carry over)
- Migration: IF NOT EXISTS, NO DEFAULT cuid(), camelCase wajib @map. ALTER COLUMN drop not null aman (additive).
- Worker task status lowercase: pending/processing/completed/failed.
- Semua LLM via src/lib/llm.ts (DeepSeek) — MVP1 gak butuh LLM.
- Tenant isolation: SEMUA query scoped userId, fail-closed.
- Token/secret JANGAN ke log/response/commit/memory.
- No force-push main. Deviation → prefix "DEVIATION:". Satu commit per fase.
- JANGAN claim DONE tanpa tsc clean + smoke test. Update /docs sebelum selesai.
