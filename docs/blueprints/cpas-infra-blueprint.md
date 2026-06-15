# Blueprint: CPAS Infrastructure Foundation

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION  
**Goal:** HSL jadi backbone penuh untuk CPAS automation — Kill, Spawn, Analyzer, Knowledge DB semua pakai HSL PostgreSQL bukan local SQLite/filesystem  
**Estimasi:** 120–150 menit Sonnet  
**Deps:** AutomationRule, WorkerTask, MetricSnapshot, CampaignSession, Cep sudah ada

---

## Infra Assessment (baca dulu)

**Yang SUDAH SIAP (tidak perlu dibangun):**
- `AutomationRule` → bisa ekspresikan T1/T2/T3 kill rules via conditionTreeJson ✅
- `RuleExecution` → logging dengan deduplicationKey ✅
- `AutomationAction` → PAUSE_ADSET, idempotencyKey, metaResponseJson ✅
- `WorkerTask` → queue dengan status/capability/priority, bisa handle 4-stage spawn ✅
- `MetricSnapshot` → standard metrics ada, rawMetricsJson untuk fallback ✅
- `/api/hermes/cep-feedback` → push winners dari Analyzer ke HSL ✅

**Yang MISSING — inilah yang dibangun blueprint ini:**
1. CPAS-specific metrics di MetricSnapshot (catalogSegmentROAS, CPLC)
2. Adset cap + metaCampaignId di CampaignSession
3. CPAS Knowledge DB (graveyard, diary, lessons) di HSL, bukan SQLite lokal
4. CEP fields CPAS (exchangeValue, deliveryStyle, hookDirection)
5. Kill action types di AutomationAction
6. Pain Library di HSL DB
7. Hermes API endpoints untuk CPAS operations
8. Seed: 5 kill rules siap pakai
9. Stop-naming enforcement di API layer

---

## 1. Schema Changes

### 1a. MetricSnapshot — CPAS fields

```prisma
// Tambah setelah field `roas`:
catalogSegmentROAS       Float?  @map("catalog_segment_roas")
catalogSegmentPurchases  Int?    @map("catalog_segment_purchases")  
catalogSegmentValue      Float?  @map("catalog_segment_value")
cplc                     Float?  // cost per link click = spend / linkClicks, stored untuk query speed
addToCartCount           Int?    @map("add_to_cart_count")
```

### 1b. CampaignSession — cap + Meta campaign ID

```prisma
// Tambah setelah field `dailyBudget`:
adsetCap        Int?    @map("adset_cap")       // max active adsets di campaign ini
metaCampaignId  String? @map("meta_campaign_id") // actual Meta campaign ID (untuk slot count live)
```

### 1c. Cep — CPAS generation fields

```prisma
// Tambah setelah field `angle`:
exchangeValue  String? @map("exchange_value")  // "instant-cerah" | "less-effort" dll
deliveryStyle  String? @map("delivery_style")  // "before-after" | "fun-fact" | "edukasi-problem"
hookDirection  String? @map("hook_direction")  // arah hook dari planner
adsetNaming    String? @map("adset_naming")    // "gatal-riskred-edukprob-035"
spawnJobId     String? @map("spawn_job_id")    // link ke WorkerTask yang men-generate CEP ini
```

### 1d. AutomationAction — tambah CPAS action types

Field `actionType` saat ini: PAUSE_CAMPAIGN | RESUME_CAMPAIGN | PAUSE_ADSET | RESUME_ADSET | UPDATE_BUDGET | CREATE_CAMPAIGN | CREATE_AD | REPLACE_AD | ADD_CREATIVE | NOTIFY

Tambah ke komentar (dokumentasi, tidak perlu migration):
```
// CPAS additions: KILL_ADSET | RENAME_ADSET | SPAWN_ADSET | REVIVE_ADSET | LOG_GRAVEYARD
```

`KILL_ADSET` = PAUSE_ADSET + RENAME_ADSET + LOG_GRAVEYARD dalam satu atomic action. Worker yang handle ini.

### 1e. Model Baru: CpasGraveyard

```prisma
model CpasGraveyard {
  id                String   @id @default(cuid())
  userId            String   @map("user_id")
  campaignSessionId String?  @map("campaign_session_id")
  metaAdsetId       String   @map("meta_adset_id")
  adsetName         String   @map("adset_name")
  campaignName      String   @map("campaign_name")
  productKey        String   @map("product_key")   // "lotion" | "moist" dll
  killTier          String   @map("kill_tier")      // "T1" | "T2" | "T3"
  killReason        String   @map("kill_reason")    // human-readable reason
  spendAtKill       Float    @map("spend_at_kill")
  roasAtKill        Float?   @map("roas_at_kill")
  catalogROASAtKill Float?   @map("catalog_roas_at_kill")
  purchasesAtKill   Int?     @map("purchases_at_kill")
  cplcAtKill        Float?   @map("cplc_at_kill")
  cepText           String?  @map("cep_text")       // CEP yang dipakai adset ini
  exchangeValue     String?  @map("exchange_value")
  deliveryStyle     String?  @map("delivery_style")
  // Repeat failure tracking
  killCount         Int      @default(1) @map("kill_count")  // kalau adset yang sama mati lagi
  firstKilledAt     DateTime @map("first_killed_at")
  lastKilledAt      DateTime @map("last_killed_at")
  notes             String?  // analyzer bisa isi ini
  createdAt         DateTime @default(now()) @map("created_at")

  user            AdminUser        @relation(fields: [userId], references: [id])
  campaignSession CampaignSession? @relation(fields: [campaignSessionId], references: [id], onDelete: SetNull)

  @@index([productKey, lastKilledAt])
  @@index([userId, createdAt])
  @@map("cpas_graveyard")
}
```

### 1f. Model Baru: CpasDiary

```prisma
model CpasDiary {
  id                String   @id @default(cuid())
  userId            String   @map("user_id")
  period            String   // "2026-06-15T06:00" — ISO string dari cron run
  productKey        String?  @map("product_key")   // null = summary semua produk
  totalSpend7d      Float?   @map("total_spend_7d")
  totalPurchases7d  Int?     @map("total_purchases_7d")
  avgROAS7d         Float?   @map("avg_roas_7d")
  activeAdsets      Int?     @map("active_adsets")
  killedThisRun     Int?     @map("killed_this_run")
  spawnedThisRun    Int?     @map("spawned_this_run")
  revivedThisRun    Int?     @map("revived_this_run")
  topWinnerCep      String?  @map("top_winner_cep")
  summaryText       String?  @map("summary_text")  // LLM summary dari analyzer
  deltaVsPrevRun    String?  @map("delta_vs_prev_run") // JSON delta metrics
  createdAt         DateTime @default(now()) @map("created_at")

  user AdminUser @relation(fields: [userId], references: [id])

  @@index([userId, period])
  @@map("cpas_diary")
}
```

### 1g. Model Baru: CpasLesson

```prisma
model CpasLesson {
  id            String   @id @default(cuid())
  userId        String   @map("user_id")
  productKey    String?  @map("product_key")
  lessonType    String   @map("lesson_type") // "WINNER_PATTERN" | "FAILURE_PATTERN" | "AUDIENCE_INSIGHT" | "CEP_INSIGHT"
  title         String
  body          String   // full lesson text dari analyzer
  confidence    String   @default("medium") // "low" | "medium" | "high"
  evidenceCount Int      @default(1) @map("evidence_count") // berapa adset/campaign yang support lesson ini
  status        String   @default("active") // "active" | "superseded" | "archived"
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  user AdminUser @relation(fields: [userId], references: [id])

  @@index([userId, productKey, lessonType])
  @@map("cpas_lessons")
}
```

### 1h. Model Baru: CpasPainEntry (Pain Library)

```prisma
model CpasPainEntry {
  id            String   @id @default(cuid())
  userId        String   @map("user_id")
  productId     String?  @map("product_id")
  productKey    String   @map("product_key")   // "lotion" | "moist" dll
  painText      String   @map("pain_text")      // "kulit kering mengelupas saat musim hujan"
  exchangeValues String[] @map("exchange_values") // ["instant-hydrate","soft-touch"]
  deliveryStyles String[] @map("delivery_styles") // ["before-after","fun-fact"]
  isActive      Boolean  @default(true) @map("is_active")
  notes         String?
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  user    AdminUser @relation(fields: [userId], references: [id])
  product Product?  @relation(fields: [productId], references: [id], onDelete: SetNull)

  @@index([productKey, isActive])
  @@map("cpas_pain_entries")
}
```

Migration command:
```bash
npx prisma migrate dev --name cpas_infra_foundation
npx prisma generate
```

---

## 2. Hermes API Endpoints (untuk Python CPAS scripts)

Semua pakai Bearer token auth via `requireApiKey` — sama dengan endpoint Hermes lainnya.

### 2a. `POST /api/hermes/cpas/graveyard`
Kill Engine write tiap ada adset mati.

```ts
// Body:
{
  metaAdsetId: string
  adsetName: string
  campaignName: string
  productKey: string
  killTier: "T1" | "T2" | "T3"
  killReason: string
  spendAtKill: number
  roasAtKill?: number
  catalogROASAtKill?: number
  purchasesAtKill?: number
  cplcAtKill?: number
  cepText?: string
  exchangeValue?: string
  deliveryStyle?: string
}
// Response: { id, killCount }
// Logic: upsert by metaAdsetId — kalau sudah ada, increment killCount + update lastKilledAt
```

### 2b. `GET /api/hermes/cpas/graveyard`
Analyzer read untuk context.

```
?productKey=lotion
?killTier=T1
?minKillCount=2        (repeat failures)
?since=2026-06-01     (ISO date)
?limit=50
→ { entries: CpasGraveyard[] }
```

### 2c. `POST /api/hermes/cpas/diary`
Analyzer write tiap run.

```ts
// Body: { period, productKey?, totalSpend7d?, avgROAS7d?, killedThisRun?, spawnedThisRun?, revivedThisRun?, summaryText?, deltaVsPrevRun? }
// Response: { id }
```

### 2d. `GET /api/hermes/cpas/diary`
```
?productKey=lotion&limit=10
→ { entries: CpasDiary[] }
```

### 2e. `POST /api/hermes/cpas/lessons`
```ts
// Body: { productKey?, lessonType, title, body, confidence?, evidenceCount? }
// Response: { id }
```

### 2f. `GET /api/hermes/cpas/lessons`
```
?productKey=lotion&lessonType=WINNER_PATTERN&status=active
→ { lessons: CpasLesson[] }
```

### 2g. `GET /api/hermes/cpas/slot-count`
Planner pakai ini buat hitung free slots. **Sumber kebenaran = WorkerTask + MetaEntity.**

```
?campaignSessionId=X
→ {
    cap: number,             // dari CampaignSession.adsetCap
    activeAdsets: number,    // MetaEntity type=ADSET status=ACTIVE
    inProcess: number,       // WorkerTask type in [cpas_spawn_*] status=pending|processing
    freeSlots: number        // cap - activeAdsets - inProcess
  }
```

Ini bukan filesystem count. Pure DB query. Atomic.

### 2h. `GET /api/hermes/cpas/pain-library`
Planner baca pain entries untuk CEP generation.

```
?productKey=lotion&isActive=true
→ { pains: CpasPainEntry[] }
```

### 2i. `POST /api/hermes/cpas/spawn-job`
Submit 4-stage spawn job ke WorkerTask queue.

```ts
// Body:
{
  productKey: string
  campaignSessionId: string
  cepData: {
    painText: string
    exchangeValue: string
    deliveryStyle: string
    hookDirection: string
    adsetNaming: string
    cepText: string
  }
  referencePhotoUrl: string  // HSL photo ref untuk APIMart
}
// Logic:
// 1. Create Cep record dengan CPAS fields
// 2. Create WorkerTask type='cpas_spawn_plan' capability='cpas-planner' payloadJson={...}
// Response: { workerTaskId, cepId }
```

### 2j. `GET /api/hermes/cpas/spawn-job/[id]`
Poller Python check status.

```
→ {
    id: string,
    status: "pending" | "processing" | "completed" | "failed",
    stage: "plan" | "image_submitted" | "images_ready" | "adset_written",
    resultJson: {...} | null
  }
// stage dibaca dari WorkerTask.type suffix
```

### 2k. `PATCH /api/hermes/cpas/spawn-job/[id]`
Worker update stage saat transisi.

```ts
// Body: { status, stage, resultJson? }
// Hanya bisa update ke stage berikutnya — tidak bisa backward
```

---

## 3. Admin Endpoints (untuk dashboard)

### 3a. `GET /api/admin/cpas/graveyard`
Dashboard view graveyard dengan pagination.

### 3b. `GET /api/admin/cpas/diary`
Dashboard view diary entries.

### 3c. `GET/POST/PATCH /api/admin/cpas/pain-library`
CRUD Pain Library dari UI.

---

## 4. Stop-Naming Enforcement

Buat helper function di `src/lib/cpas-guards.ts`:

```ts
// Returns true kalau campaign name punya suffix " - stop" (case-insensitive)
export function hasSoftStop(campaignName: string): boolean {
  return / - stop$/i.test(campaignName.trim())
}

// Guard untuk dipakai di route handlers yang trigger write ke Meta
// Throw 403 kalau campaign punya stop suffix
export function assertNotStopped(campaignName: string) {
  if (hasSoftStop(campaignName)) {
    throw new Error(`Campaign "${campaignName}" has soft-stop suffix — write blocked`)
  }
}

// Guard untuk write scope: hanya campaign yang mengandung "hermes" boleh di-write
export function assertHermesScope(campaignName: string) {
  if (!campaignName.toLowerCase().includes('hermes')) {
    throw new Error(`Campaign "${campaignName}" is outside Hermes write scope`)
  }
}
```

Pakai di: `AutomationAction` creation routes + `WorkerTask` CPAS spawn routes.

---

## 5. Seed: CPAS Kill Rules

Buat file `prisma/cpas-seed.ts` (dipanggil manual, bukan bagian dari main seed):

```ts
// 5 AutomationRule records untuk Taracare CPAS campaigns
// Setiap CampaignSession yang punya metaCampaignId "Hermes - purchase - X" 
// akan di-assign rules ini

const CPAS_RULES = [
  // PURCHASE T1: spend ≥ 10K, ROAS=0, purchases=0 → KILL
  {
    name: "CPAS Purchase T1 — Zero Purchase Early Kill",
    scope: "ADSET",
    ruleCategory: "THRESHOLD",
    conditionTreeJson: JSON.stringify({
      operator: "AND",
      conditions: [
        { field: "spend", op: "gte", value: 10000 },
        { field: "catalogSegmentROAS", op: "lte", value: 2.0 },
        { field: "catalogSegmentPurchases", op: "eq", value: 0 }
      ]
    }),
    actionSpecJson: JSON.stringify({
      type: "KILL_ADSET",
      killTier: "T1",
      rename_prefix: "(KILL)",
      log_graveyard: true
    }),
    evaluationWindowMinutes: 60,
    cooldownMinutes: 0,  // kill = irreversible, tidak perlu cooldown
    priority: 1,
  },
  // PURCHASE T2: spend ≥ 20K, CPLC > 4000 → KILL
  {
    name: "CPAS Purchase T2 — High CPLC Kill",
    scope: "ADSET",
    ruleCategory: "THRESHOLD",
    conditionTreeJson: JSON.stringify({
      operator: "AND",
      conditions: [
        { field: "spend", op: "gte", value: 20000 },
        { field: "cplc", op: "gt", value: 4000 }
      ]
    }),
    actionSpecJson: JSON.stringify({ type: "KILL_ADSET", killTier: "T2", rename_prefix: "(KILL)", log_graveyard: true }),
    evaluationWindowMinutes: 60,
    cooldownMinutes: 0,
    priority: 2,
  },
  // PURCHASE T3: spend ≥ 50K, ROAS < 0.5 → KILL
  {
    name: "CPAS Purchase T3 — Low ROAS Sustained Kill",
    scope: "ADSET",
    ruleCategory: "THRESHOLD",
    conditionTreeJson: JSON.stringify({
      operator: "AND",
      conditions: [
        { field: "spend", op: "gte", value: 50000 },
        { field: "catalogSegmentROAS", op: "lt", value: 0.5 }
      ]
    }),
    actionSpecJson: JSON.stringify({ type: "KILL_ADSET", killTier: "T3", rename_prefix: "(KILL)", log_graveyard: true }),
    evaluationWindowMinutes: 60,
    cooldownMinutes: 0,
    priority: 3,
  },
  // ATC T1: spend ≥ 10K, add_to_cart = 0 → KILL
  {
    name: "CPAS ATC T1 — Zero ATC Kill",
    scope: "ADSET",
    ruleCategory: "THRESHOLD",
    conditionTreeJson: JSON.stringify({
      operator: "AND",
      conditions: [
        { field: "spend", op: "gte", value: 10000 },
        { field: "addToCartCount", op: "eq", value: 0 }
      ]
    }),
    actionSpecJson: JSON.stringify({ type: "KILL_ADSET", killTier: "T1", rename_prefix: "(KILL)", log_graveyard: true }),
    evaluationWindowMinutes: 60,
    cooldownMinutes: 0,
    priority: 1,
  },
  // ATC T2: CPLC > 2500 → KILL
  {
    name: "CPAS ATC T2 — High CPLC Kill",
    scope: "ADSET",
    ruleCategory: "THRESHOLD",
    conditionTreeJson: JSON.stringify({
      operator: "AND",
      conditions: [
        { field: "cplc", op: "gt", value: 2500 }
      ]
    }),
    actionSpecJson: JSON.stringify({ type: "KILL_ADSET", killTier: "T2", rename_prefix: "(KILL)", log_graveyard: true }),
    evaluationWindowMinutes: 60,
    cooldownMinutes: 0,
    priority: 2,
  },
]
```

Seed script ini mengambil `userId` dari env (`CPAS_ADMIN_USER_ID`) dan upsert rules by name — idempotent.

---

## 6. WorkerTask Types untuk CPAS Spawn Pipeline

Tidak perlu schema change. Gunakan field yang ada:

| Stage | type | capability | payloadJson wajib |
|-------|------|------------|-------------------|
| Planner | `cpas_spawn_plan` | `cpas-planner` | `{ campaignSessionId, cepId, productKey }` |
| Submitter | `cpas_image_submit` | `cpas-submitter` | `+ referencePhotoUrl, apmartTaskIds: null` |
| Poller | `cpas_image_poll` | `cpas-poller` | `+ apmartTaskIdA, apmartTaskIdB` |
| Writer | `cpas_adset_write` | `cpas-writer` | `+ imageUrlA, imageUrlB, targetCampaignId` |

Setiap stage: saat complete → create WorkerTask stage berikutnya (chain). Writer pakai single-worker lock via `capability='cpas-writer'` — hanya satu worker yang handle capability ini (serial).

---

## 7. Dashboard: CPAS Tab di System

File: `src/app/system/CpasTab.tsx` (client component, optional tab)

Layout:
```
┌─ CPAS Overview ───────────────────────────────────────┐
│ Products:  lotion 🟢  moist 🟢  melastop 🟡  ...     │
│ Active today: 47 adsets killed · 23 spawned · 3 revived│
├───────────────────────────────────────────────────────┤
│ [Graveyard] [Diary] [Lessons] [Pain Library]          │
│                                                        │
│ Graveyard (50 entries)                                │
│ Repeat failures: gatal-riskred-X killed 3x in 7 days │
│ ...                                                   │
├───────────────────────────────────────────────────────┤
│ Spawn Queue (WorkerTask status)                       │
│ pending: 2 · processing: 1 · completed today: 18     │
└───────────────────────────────────────────────────────┘
```

Tab ini ditambahkan ke System page (admin-only). Bukan tab terpisah di nav.

---

## 8. Aturan Wajib

- Semua `/api/hermes/cpas/*` pakai `requireApiKey` (HermesAgent token, bukan session cookie)
- Semua `/api/admin/cpas/*` pakai `requireAuth` (session)
- `hasSoftStop()` dan `assertHermesScope()` dari `cpas-guards.ts` wajib dipanggil di setiap write endpoint yang trigger Meta action
- `slot-count` endpoint harus atomic — query WorkerTask + MetaEntity dalam satu prisma.$transaction
- Graveyard upsert by `metaAdsetId` — jangan create duplicate, increment killCount
- CPLC computed dan disimpan saat MetricSnapshot insert: `cplc = linkClicks > 0 ? spend / linkClicks : null`
- tsc --noEmit 0 error dari semua file baru
- Migration harus `--name cpas_infra_foundation` (satu migration, bukan pecah-pecah)
- No force-push ke main
- JANGAN claim done sebelum: (1) tsc clean, (2) `GET /api/hermes/cpas/slot-count` return valid response, (3) graveyard upsert test

---

## 9. Execution Order

```
1. Edit prisma/schema.prisma
   - Tambah fields ke MetricSnapshot, CampaignSession, Cep
   - Tambah 4 model baru (CpasGraveyard, CpasDiary, CpasLesson, CpasPainEntry)
   - Tambah relasi balik di AdminUser

2. npx prisma migrate dev --name cpas_infra_foundation
3. npx prisma generate

4. Buat src/lib/cpas-guards.ts (hasSoftStop, assertHermesScope)

5. Buat src/app/api/hermes/cpas/ directory:
   - graveyard/route.ts (GET + POST)
   - diary/route.ts (GET + POST)
   - lessons/route.ts (GET + POST)
   - slot-count/route.ts (GET)
   - pain-library/route.ts (GET)
   - spawn-job/route.ts (POST)
   - spawn-job/[id]/route.ts (GET + PATCH)

6. Buat src/app/api/admin/cpas/ directory:
   - graveyard/route.ts (GET)
   - diary/route.ts (GET)
   - pain-library/route.ts (GET + POST + PATCH)

7. Buat prisma/cpas-seed.ts (5 AutomationRule records)

8. Buat src/app/system/CpasTab.tsx (dashboard sederhana)
9. Edit src/app/system/page.tsx — tambah CpasTab (admin-only)

10. npx tsc --noEmit — fix semua error di file baru

11. git add + commit + push

12. Lapor:
    - List semua endpoint yang dibuat + method
    - Contoh response GET /api/hermes/cpas/slot-count
    - Contoh body POST /api/hermes/cpas/graveyard
    - Schema diff (fields apa yang ditambah ke model existing)
```

---

## 10. Yang TIDAK Dibangun di Blueprint Ini (optional, nanti)

- APIMart integration (image generation via gpt-image-2) — Python CPAS tetap handle ini
- Revive logic automation — tetap di Analyzer Python
- Delete Engine UI — tetap di Python, cukup log ke graveyard
- Top Up Engine — PAUSED, tidak disentuh
- CPAS attribution ke LP/CEP stats — masuk blueprint Attribution Layer (terpisah)
