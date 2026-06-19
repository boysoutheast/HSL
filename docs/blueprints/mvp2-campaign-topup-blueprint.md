# Blueprint MVP 2 — Campaign Min-Ads Floor + Campaign-Specific Creative Top-Up

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION (Sonnet VPS)
**Estimasi:** 4–5 jam · **Depends on:** MVP1 (import + attach rules) sudah jalan
**Tujuan:** Tiap campaign punya setting "minimal X ads aktif". Kalau iklan dimatiin rule sampai di bawah floor, HSL auto top-up ad BARU — tapi pakai creative pool khusus campaign itu (headline/description/primary text yang user siapin), BUKAN dari content library global.

---

## 0. Bedanya dengan yang sudah ada

| | MediaLibraryRule (existing) | Campaign Top-Up (MVP2 — baru) |
|---|---|---|
| Scope | Refill **content library** global | Refill **ads di 1 campaign spesifik** |
| Sumber | Media asset di library | Creative pool yang disiapin user PER campaign |
| Trigger | MIN_COUNT/MAX_AGE/NO_WINNER konten | Active ad count < minActiveAds |
| Output | MediaAsset baru | Ad baru di Meta (CREATE_AD/ADD_CREATIVE) |
| Copy | — | primaryText/headline/description disiapin user di muka |

**Inti MVP2:** copy iklan (primary text, headline, description, CTA, link) disiapin user duluan dalam "pool" yang nempel di campaign. Saat floor breach, ambil 1 creative available dari pool → bikin ad → tandai used.

---

## 1. DB Changes

Migration: `prisma/migrations/20260615000002_mvp2_campaign_topup/migration.sql`
(IF NOT EXISTS, NO DEFAULT cuid(), camelCase wajib @map snake_case)

```sql
-- Setting floor + top-up per campaign
ALTER TABLE campaign_sessions
  ADD COLUMN IF NOT EXISTS min_active_ads   INTEGER NOT NULL DEFAULT 0,  -- 0 = fitur off
  ADD COLUMN IF NOT EXISTS topup_enabled    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS topup_target_adset_id TEXT;  -- adset tujuan ad baru (nullable = adset pertama aktif)

-- Pool creative khusus campaign — copy disiapin user di muka
CREATE TABLE IF NOT EXISTS campaign_creative_pool (
  id                  TEXT PRIMARY KEY,
  campaign_session_id TEXT NOT NULL REFERENCES campaign_sessions(id) ON DELETE CASCADE,
  user_id             TEXT NOT NULL,
  -- copy iklan
  primary_text        TEXT NOT NULL,
  headline            TEXT,
  description         TEXT,
  call_to_action      TEXT NOT NULL DEFAULT 'LEARN_MORE',  -- LEARN_MORE|SHOP_NOW|SIGN_UP|...
  link_url            TEXT,
  -- media (opsional — boleh pakai media asset existing atau creative_url manual)
  media_asset_id      TEXT,
  creative_url        TEXT,
  format              TEXT NOT NULL DEFAULT 'single',       -- single|carousel
  -- lifecycle
  sort_order          INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'available',     -- available|used|failed|archived
  used_at             TIMESTAMPTZ,
  used_meta_ad_id     TEXT,                                  -- ad Meta hasil top-up
  failed_reason       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ccp_session_status ON campaign_creative_pool(campaign_session_id, status);
CREATE INDEX IF NOT EXISTS idx_ccp_user ON campaign_creative_pool(user_id);

-- Audit top-up event
CREATE TABLE IF NOT EXISTS campaign_topup_log (
  id                   TEXT PRIMARY KEY,
  campaign_session_id  TEXT NOT NULL REFERENCES campaign_sessions(id) ON DELETE CASCADE,
  triggered_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active_ads_before    INTEGER NOT NULL,
  min_active_ads       INTEGER NOT NULL,
  pool_creative_id     TEXT,
  automation_action_id TEXT,
  status               TEXT NOT NULL DEFAULT 'pending',  -- pending|succeeded|failed|skipped_empty_pool
  note                 TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topup_log_session ON campaign_topup_log(campaign_session_id, triggered_at);
```

Prisma schema:
```prisma
// model CampaignSession — tambah
minActiveAds       Int      @default(0) @map("min_active_ads")
topupEnabled       Boolean  @default(false) @map("topup_enabled")
topupTargetAdsetId String?  @map("topup_target_adset_id")
creativePool       CampaignCreativePool[]
topupLogs          CampaignTopupLog[]

model CampaignCreativePool {
  id                String    @id @default(cuid())
  campaignSessionId String    @map("campaign_session_id")
  userId            String    @map("user_id")
  primaryText       String    @map("primary_text")
  headline          String?
  description       String?
  callToAction      String    @default("LEARN_MORE") @map("call_to_action")
  linkUrl           String?   @map("link_url")
  mediaAssetId      String?   @map("media_asset_id")
  creativeUrl       String?   @map("creative_url")
  format            String    @default("single")
  sortOrder         Int       @default(0) @map("sort_order")
  status            String    @default("available")  // available|used|failed|archived
  usedAt            DateTime? @map("used_at")
  usedMetaAdId      String?   @map("used_meta_ad_id")
  failedReason      String?   @map("failed_reason")
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")

  campaignSession CampaignSession @relation(fields: [campaignSessionId], references: [id], onDelete: Cascade)

  @@index([campaignSessionId, status])
  @@index([userId])
  @@map("campaign_creative_pool")
}

model CampaignTopupLog {
  id                 String   @id @default(cuid())
  campaignSessionId  String   @map("campaign_session_id")
  triggeredAt        DateTime @default(now()) @map("triggered_at")
  activeAdsBefore    Int      @map("active_ads_before")
  minActiveAds       Int      @map("min_active_ads")
  poolCreativeId     String?  @map("pool_creative_id")
  automationActionId String?  @map("automation_action_id")
  status             String   @default("pending")
  note               String?
  createdAt          DateTime @default(now()) @map("created_at")

  campaignSession CampaignSession @relation(fields: [campaignSessionId], references: [id], onDelete: Cascade)

  @@index([campaignSessionId, triggeredAt])
  @@map("campaign_topup_log")
}
```

`npx prisma generate` setelah edit.

---

## 2. Endpoints

### 2.1 Creative Pool CRUD
`GET /api/admin/campaign-sessions/[id]/creative-pool`
List pool creative (scoped userId + session). Return dengan counts: available/used/failed.

`POST /api/admin/campaign-sessions/[id]/creative-pool`
Body: `{ primaryText*, headline?, description?, callToAction?, linkUrl?, mediaAssetId?, creativeUrl?, format? }`
- Validasi: `primaryText` wajib (max 125 char Meta limit — soft warn di UI, hard cap 2000 di server).
- Minimal salah satu: `mediaAssetId` ATAU `creativeUrl` (ad butuh media). Kalau dua-duanya kosong → 422 "Pilih media".
- sortOrder auto = max+1.

`PATCH /api/admin/campaign-sessions/[id]/creative-pool/[poolId]`
Edit copy / reorder / archive. JANGAN izinkan edit kalau status='used' (immutable history) → 409.

`DELETE /api/admin/campaign-sessions/[id]/creative-pool/[poolId]`
Soft delete (status='archived') kalau used; hard delete kalau masih available.

`POST /api/admin/campaign-sessions/[id]/creative-pool/bulk`
Body: `{ items: [...] }` — bikin banyak sekaligus (user siapin 5-10 creative sekali input). Max 50/request.

### 2.2 Floor + top-up setting
`PATCH /api/admin/campaign-sessions/[id]`
Tambah field: `{ minActiveAds?, topupEnabled?, topupTargetAdsetId? }`
- `minActiveAds` range 0–50. 0 = fitur off.
- `topupEnabled=true` guard: WAJIB `minActiveAds > 0` AND pool punya ≥1 creative available → else 422 dgn pesan jelas ("Set min ads + siapin minimal 1 creative pool").

### 2.3 Manual trigger (testing/ops)
`POST /api/admin/campaign-sessions/[id]/topup/run`
Force evaluate floor sekarang (untuk test tanpa nunggu scan). Return `{ activeAds, minActiveAds, action: 'created'|'skipped', topupLogId? }`.

### 2.4 Internal — scan engine integration
`GET /api/internal/monitor/sessions` (existing) — tambah ke select: `minActiveAds, topupEnabled, topupTargetAdsetId`, plus count AD entities yang ACTIVE.
`POST /api/internal/campaign-sessions/[id]/topup-claim` (worker auth `x-api-key`)
Worker panggil saat detect floor breach. Flow ATOMIC:
```
1. Hitung active ad: COUNT MetaEntity WHERE entityType='AD' AND effectiveStatus='ACTIVE'
2. Kalau active >= minActiveAds → return { action: 'skip' }
3. need = minActiveAds - active
4. Loop need kali (atau sampai pool habis):
   a. Ambil 1 pool creative status='available' ORDER BY sortOrder (FOR UPDATE / conditional update lock)
   b. Atomic claim: updateMany WHERE id AND status='available' SET status='used', usedAt=now
      → kalau count=0 (kebalap), skip ke creative berikut
   c. Create AutomationAction actionType='CREATE_AD' source='SYSTEM'
      payload { campaignSessionId, adsetId: topupTargetAdsetId ?? <first active adset>,
                primaryText, headline, description, callToAction, linkUrl, mediaAssetId/creativeUrl }
   d. Create CampaignTopupLog { activeAdsBefore, minActiveAds, poolCreativeId, automationActionId, status='pending' }
5. Kalau pool habis sebelum floor kepenuhin → CampaignTopupLog status='skipped_empty_pool',
   create AutomationAction NOTIFY (alert user "pool habis, campaign X di bawah floor")
6. Return { created: n, skippedEmptyPool: bool }
```
`PATCH /api/internal/campaign-sessions/topup-log/[id]` — worker update hasil setelah ad kebuat di Meta: `{ status: 'succeeded'|'failed', usedMetaAdId?, failedReason? }`. Kalau failed → balikin pool creative ke 'available' (atau 'failed' kalau error permanen) supaya gak hangus.

---

## 3. Top-Up Logic — Detail Penting

- **Active ad count** = MetaEntity entityType='AD' effectiveStatus='ACTIVE' di session itu. Sumber kebenaran = hasil sync worker (MVP1), bukan tebakan.
- **Idempotency:** AutomationAction punya idempotencyKey unik. Format: `topup_{sessionId}_{poolCreativeId}`. Dua scan bertabrakan → cuma 1 action kebuat (unique constraint).
- **Pool exhaustion:** floor breach tapi pool kosong → JANGAN spam. Set log 'skipped_empty_pool', NOTIFY sekali per breach (cooldown 60m via cek log terakhir).
- **Race antar scan:** claim pool pakai conditional updateMany (status guard), sama pola seperti credit debit / task claim yang sudah ada. JANGAN read-then-write.
- **Failed ad:** worker lapor failed → pool creative balik 'available' (retryable) atau 'failed' (copy ditolak Meta). Bedanya dari errorCode worker.

---

## 4. UI/UX — Campaign Detail → tab "Top-Up"

Tab baru di `/campaign-monitor/[id]` (atau section di detail): **"Auto Top-Up"**.

### 4.1 Floor setting (header)
```
┌─ Auto Top-Up ──────────────────────────── [Toggle: OFF/ON] ┐
│  Minimal ads aktif:  [ 3 ]  ads                             │
│  Tujuan adset:       [ Broad 25-45 ▾ ]  (default: pertama) │
│  Status: 🟢 4 ads aktif — di atas floor                    │
│          (atau 🔴 2/3 aktif — top-up jalan saat scan)      │
└────────────────────────────────────────────────────────────┘
```
- Toggle ON disabled + tooltip kalau minActiveAds=0 atau pool available=0.
- Live status: bandingin active ad count vs floor (dari latest sync).

### 4.2 Creative Pool manager
```
┌─ Creative Pool ──── 5 available · 2 used ──── [+ Tambah Creative] ┐
│  ▦ #1  "Kulit kusam? Glow dalam 7 hari..."   available   [edit]  │
│        Headline: Glow Up Sekarang · CTA: SHOP_NOW · 🖼 media ok   │
│  ▦ #2  "Review jujur produk viral..."        available   [edit]  │
│  ▦ #3  "Promo terbatas hari ini..."          ✓ used 2h   →ad_123 │
│        (used — locked, gak bisa diedit)                          │
└──────────────────────────────────────────────────────────────────┘
```
- **"+ Tambah Creative"** → modal form: primaryText (textarea + counter 125), headline, description, CTA dropdown, link URL, pilih media (dari MediaAsset library ATAU paste URL). Preview ad-style.
- **Bulk add**: tab "Paste banyak" — textarea, 1 creative per blok dipisah `---`, parse → preview → submit bulk.
- Drag reorder = sortOrder (urutan dipakai saat top-up).
- Card used: locked, badge link ke ad Meta.
- Empty state: "Belum ada creative. Top-up butuh minimal 1 creative siap pakai." + CTA.

### 4.3 Top-Up activity log
```
┌─ Riwayat Top-Up ──────────────────────────────────────────┐
│  🔼 14:30  2→3 ads · pakai creative #1 · ad_123 · SUCCESS │
│  ⚠️ 09:15  1→? · pool habis · NOTIFIED                     │
└───────────────────────────────────────────────────────────┘
```
Dari `GET /api/admin/campaign-sessions/[id]/topup-log`. Polling 30s.

### 4.4 Campaign card badge (list)
Tambah chip di card campaign: `🔼 Floor 3 · pool 5` (klik → tab top-up). Merah kalau under floor.

---

## 5. Acceptance Criteria

- [ ] Set minActiveAds + isi pool → toggle top-up bisa ON
- [ ] topupEnabled ON ditolak kalau pool kosong atau minActiveAds=0 (422)
- [ ] Saat active ad < floor → scan trigger → pool creative diambil (sortOrder), AutomationAction CREATE_AD kebuat, pool jadi 'used'
- [ ] Pool claim atomic — 2 scan bareng gak dobel pakai creative sama (idempotencyKey + conditional update)
- [ ] Pool habis saat floor breach → log 'skipped_empty_pool' + NOTIFY sekali (gak spam)
- [ ] Ad gagal kebuat → pool creative balik available/failed sesuai errorCode
- [ ] Creative used = immutable (edit ditolak 409)
- [ ] Bulk add pool jalan (max 50)
- [ ] Tenant isolation: pool + log + setting scoped userId, user lain gak bisa lihat/edit
- [ ] UI: floor setting, pool manager (add/bulk/reorder/edit/lock), activity log, card badge
- [ ] tsc --noEmit 0 error (file disentuh)
- [ ] Update `/docs` — section campaign top-up + creative pool

---

## 6. Execution Order

```
1. Migration SQL + prisma schema (floor fields + 2 tabel baru) → prisma generate
2. Creative Pool CRUD (GET/POST/PATCH/DELETE/bulk)
3. PATCH campaign-sessions/[id] — floor + topupEnabled guard
4. POST topup/run (manual trigger, buat test)
5. Internal: topup-claim (atomic pool claim + action create) + topup-log PATCH + sessions select fields
6. UI: tab Auto Top-Up — floor setting
7. UI: Creative Pool manager (form + bulk + reorder + lock)
8. UI: top-up activity log + card badge
9. Update /docs
10. tsc --noEmit → fix
11. Commit per fase, push. Smoke test pakai topup/run manual.
```

---

## 7. Handoff ke Worker Repo (TERPISAH — hermes-worker)

Sebut di laporan, JANGAN dikerjakan di HSL:
- Saat scan: hitung active AD, kalau < minActiveAds → panggil `POST /api/internal/campaign-sessions/[id]/topup-claim`
- Eksekusi AutomationAction `CREATE_AD` ke Meta (pakai payload pool creative) — bikin creative + ad di adset target
- Lapor balik via `PATCH /api/internal/campaign-sessions/topup-log/[id]` (succeeded + usedMetaAdId / failed + reason)

---

## Aturan Wajib (carry over)
- Migration: IF NOT EXISTS, NO DEFAULT cuid(), camelCase wajib @map snake_case.
- Pool claim & action create ATOMIC (conditional updateMany, bukan read-then-write) — pola sama kayak credit engine.
- Idempotency: AutomationAction.idempotencyKey = `topup_{sessionId}_{poolCreativeId}`.
- Worker task status lowercase. Token/secret JANGAN ke log/response/commit/memory.
- Tenant isolation semua query scoped userId, fail-closed.
- No force-push main. Deviation → prefix "DEVIATION:". Satu commit per fase.
- JANGAN claim DONE tanpa tsc clean + smoke test (pakai topup/run). Update /docs sebelum selesai.
- LLM (kalau nanti mau auto-generate copy) WAJIB via src/lib/llm.ts (DeepSeek) — MVP2 ini copy manual dulu, LLM-assist = fase lanjutan.
```
