# Blueprint: ABO Support (Ad Set Budget Optimization)

**Author:** Fable 5 (blueprint only) · **Executor:** Sonnet · **Auditor:** Fable 5
**Tanggal:** 2026-06-12 · **Repo:** hermes-support-web (Railway, ai.boytenggara.com)

---

## 0. Goal

Existing: 1 TestLaunch = 1 campaign (CBO) → 1 adset implisit → N creatives. **Sudah jalan, jangan rusak.**

Target: user bisa pilih **Budget Mode**:
- **CBO** — budget di campaign, Meta distribusi otomatis ke adsets (= behavior sekarang)
- **ABO** — budget per adset; 1 campaign → N adsets → masing-masing N creatives

Prinsip: **additive only**. Semua perubahan schema nullable/default, payload lama tetap valid, row lama tetap kebaca. Zero breaking change.

---

## 1. Meta API Contract (acuan worker & payload)

> Versi pinned: `v25.0` via `src/lib/meta-graph.ts` (`graphFetch`). JANGAN hardcode versi lain.

### CBO (sekarang)
| Object | Field |
|---|---|
| Campaign | `name`, `objective`, `daily_budget` (minor units), `bid_strategy`, `special_ad_categories`, `status` |
| Ad Set | `campaign_id`, `optimization_goal`, `billing_event`, `targeting`, `promoted_object` (pixel utk SALES), `bid_amount` (kalau COST_CAP/BID_CAP), **TANPA `daily_budget`** |

### ABO (baru)
| Object | Field |
|---|---|
| Campaign | `name`, `objective`, `special_ad_categories`, `status`, **TANPA `daily_budget`, TANPA `bid_strategy`** |
| Ad Set | semua field CBO **PLUS `daily_budget`** (minor units, per adset) dan `bid_strategy` + `bid_amount` per adset |

### Aturan keras (Meta reject kalau dilanggar)
1. Campaign `daily_budget` terisi + adset `daily_budget` terisi → **error**. Pilih salah satu level.
2. ABO: setiap adset WAJIB punya `daily_budget` sendiri.
3. `bid_strategy=LOWEST_COST_WITH_MIN_ROAS` → adset butuh `bid_constraints: {roas_average_floor}` (int, 10000 = ROAS 1.0).
4. Minimum daily budget per adset tergantung currency + billing event — **JANGAN hardcode angka minimum**; biarkan Meta validasi, surface error message-nya ke user apa adanya.
5. Mapping bid strategy HSL → Meta: `HIGHEST_VOLUME` → `LOWEST_COST_WITHOUT_CAP`, `COST_CAP` → `COST_CAP`, `BID_CAP` → `LOWEST_COST_WITH_BID_CAP`, `MIN_ROAS` → `LOWEST_COST_WITH_MIN_ROAS`.

⚠️ Eksekutor: verifikasi ulang field names ke `developers.facebook.com/docs/marketing-api/reference/ad-campaign/` saat implement worker payload — docs Meta sering minta login, kalau gagal fetch pakai kontrak di atas (sudah konsisten dengan implementasi CBO yang verified jalan).

---

## 2. Current State (verified dari kode, 2026-06-12)

- `prisma/schema.prisma`: `TestLaunch` (flat, `dailyBudget` wajib di campaign level, `bidStrategyJson`), `TestLaunchCreative` (FK langsung ke TestLaunch, no adset level).
- `POST /api/admin/test-launches` (`src/app/api/admin/test-launches/route.ts`): terima `creatives[]` flat + validasi primaryText ≤125 / headline ≤255.
- Approval flow (`src/app/api/admin/approval-requests/[id]/route.ts` PATCH): build payload flat `{creatives[], dailyBudget, ...}` → `workerTask.create({type: 'create_full_launch'})`.
- Wizard (`src/app/test-launches/new/page.tsx`): 6 step — Basic Config / Page & Instagram / Placement / Audience / Pixel / Creatives. Bid strategy di-fetch per ad account via `/api/admin/meta-tools/adaccount-capabilities`.
- Worker eksternal (repo Hermes terpisah) konsumsi `worker_tasks.payload_json` — **belum implement task types baru**, lihat §7.

---

## 3. Schema Changes (additive)

```prisma
// TestLaunch — tambah 1 field
model TestLaunch {
  // ...existing...
  budgetMode String @default("CBO") @map("budget_mode") // CBO | ABO
  adsets     TestLaunchAdset[]
}

// Model BARU
model TestLaunchAdset {
  id           String   @id @default(cuid())
  testLaunchId String   @map("test_launch_id")
  name         String
  dailyBudget  Decimal? @map("daily_budget") @db.Decimal(12, 2) // wajib kalau parent ABO
  bidStrategyJson String? @map("bid_strategy_json") // override per adset; null = inherit campaign
  audienceJson String?  @map("audience_json")       // override per adset; null = inherit campaign
  sortOrder    Int      @default(0) @map("sort_order")
  status       String   @default("pending")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  testLaunch TestLaunch           @relation(fields: [testLaunchId], references: [id], onDelete: Cascade)
  creatives  TestLaunchCreative[]

  @@index([testLaunchId])
  @@map("test_launch_adsets")
}

// TestLaunchCreative — tambah FK nullable
model TestLaunchCreative {
  // ...existing...
  adsetId String? @map("adset_id") // NULL = legacy CBO (langsung di bawah campaign)
  adset   TestLaunchAdset? @relation(fields: [adsetId], references: [id], onDelete: SetNull)
  @@index([adsetId])
}
```

**Semantik backward-compat:** `budgetMode='CBO'` + creatives `adsetId=NULL` = struktur lama persis. Tidak ada backfill data.

### Migration SQL — `prisma/migrations/20260612100000_add_abo_adsets/migration.sql`

⚠️ **PELAJARAN SESSION SEBELUMNYA — WAJIB PATUH:**
- JANGAN pakai `DEFAULT cuid()` di SQL (bukan fungsi PostgreSQL; id digenerate Prisma app-layer)
- JANGAN pakai `randomblob` (itu SQLite)
- Semua `CREATE TABLE/INDEX` pakai `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`
- **SETIAP field camelCase di Prisma WAJIB `@map("snake_case")`** — bug `moderationStatus` tanpa `@map` bikin P2022 di produksi
- Setelah edit schema: `npx prisma generate` lalu `npm run build` sebelum commit

```sql
ALTER TABLE "test_launches" ADD COLUMN IF NOT EXISTS "budget_mode" TEXT NOT NULL DEFAULT 'CBO';

CREATE TABLE IF NOT EXISTS "test_launch_adsets" (
    "id" TEXT NOT NULL,
    "test_launch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "daily_budget" DECIMAL(12,2),
    "bid_strategy_json" TEXT,
    "audience_json" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "test_launch_adsets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "test_launch_adsets_test_launch_id_fkey"
        FOREIGN KEY ("test_launch_id") REFERENCES "test_launches"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "test_launch_adsets_test_launch_id_idx" ON "test_launch_adsets"("test_launch_id");

ALTER TABLE "test_launch_creatives" ADD COLUMN IF NOT EXISTS "adset_id" TEXT;
CREATE INDEX IF NOT EXISTS "test_launch_creatives_adset_id_idx" ON "test_launch_creatives"("adset_id");
-- FK pakai DO block supaya idempotent (ADD CONSTRAINT tidak punya IF NOT EXISTS)
DO $$ BEGIN
    ALTER TABLE "test_launch_creatives"
        ADD CONSTRAINT "test_launch_creatives_adset_id_fkey"
        FOREIGN KEY ("adset_id") REFERENCES "test_launch_adsets"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

---

## 4. API Changes

### `POST /api/admin/test-launches`

Request — tambah field, dua shape valid:

```jsonc
// Shape A (existing, tetap jalan) — CBO
{ "budgetMode": "CBO", "dailyBudget": 50000, "bidStrategy": {...}, "creatives": [...] }

// Shape B (baru) — ABO
{
  "budgetMode": "ABO",
  // dailyBudget campaign-level DIABAIKAN/ditolak saat ABO
  "adsets": [
    {
      "name": "Adset Jawa",
      "dailyBudget": 30000,
      "bidStrategy": { "strategy": "HIGHEST_VOLUME" },   // optional, default inherit
      "audienceJson": "{...}",                            // optional, default inherit campaign audience
      "creatives": [ { "creativeUrl": "...", "primaryText": "...", "headline": "...", "callToAction": "...", "sortOrder": 0 } ]
    }
  ]
}
```

Validasi server (semua return 400 + pesan jelas):
| Kondisi | Rule |
|---|---|
| `budgetMode` | hanya `CBO`/`ABO`, default `CBO` kalau absen |
| ABO | `adsets.length >= 1`; tiap adset: `name` non-empty, `dailyBudget > 0`, `creatives.length >= 1` |
| ABO | `dailyBudget` campaign-level harus absen/null → kalau terisi, 400 "ABO: budget diisi per adset, bukan campaign" |
| CBO | `dailyBudget > 0` wajib (existing); `adsets` harus absen |
| Semua creative (nested ataupun flat) | primaryText ≤125, headline ≤255 (reuse validasi existing) |

Persist: `$transaction` — create TestLaunch → create adsets → create creatives dengan `adsetId`. CBO ABO sama-sama lewat transaksi.

Catatan kolom DB: CBO simpan `dailyBudget` campaign seperti sekarang; ABO simpan `dailyBudget = SUM(adset budgets)` sebagai denormalized total (kolom non-null existing, dipakai display list).

### `GET /api/admin/test-launches/[id]`
Include `adsets: { include: { creatives: true }, orderBy: { sortOrder: 'asc' } }`. Ownership filter existing tetap.

---

## 5. Approval → Worker Payload v2

Di `approval-requests/[id]/route.ts` PATCH (approved branch), ganti payload builder:

```jsonc
{
  "payloadVersion": 2,
  "budgetMode": "CBO" | "ABO",
  "campaign": {
    "name": "...", "objective": "...",
    "dailyBudget": 50000,        // HANYA kalau CBO; ABO: field absen
    "bidStrategy": {...}          // HANYA kalau CBO
  },
  "adsets": [                     // SELALU array, CBO = 1 elemen
    {
      "name": "...",              // CBO: pakai nama campaign + " - Adset"
      "dailyBudget": 30000,       // HANYA kalau ABO
      "bidStrategy": {...},       // ABO per-adset (fallback ke campaign-level kalau null)
      "audience": {...},          // per-adset atau inherit
      "placements": [...], "placementMode": "...",
      "creatives": [ { "imageUrl": "...", "primaryText": "...", "headline": "...", "callToAction": "..." } ]
    }
  ],
  "adAccountId": "...", "pageId": "...", "igAccountId": "...", "pixelId": "...",
  "metaConnectionId": "...", "snapshotAt": "..."
}
```

**Backward compat worker lama:** untuk CBO, SELAIN struktur v2 di atas, tetap sertakan field flat lama (`creatives[]`, `dailyBudget`, `audience`, dst di root) — worker lama baca flat & ignore field baru; worker baru cek `payloadVersion >= 2` dan pakai `adsets[]`. ABO **hanya** emit v2 + taskType baru `create_full_launch_abo` supaya worker lama tidak salah eksekusi ABO sebagai CBO.

```
taskType: CBO → 'create_full_launch' (tidak berubah)
          ABO → 'create_full_launch_abo' (baru)
```

---

## 6. Wizard UI (`test-launches/new/page.tsx`)

Step 1 Basic Config:
- Toggle **Budget Mode**: `[ CBO — budget campaign ] [ ABO — budget per adset ]` (pattern toggle Launch Mode existing)
- CBO → Daily Budget input tampil (existing). ABO → input itu hidden, ganti hint "Budget diisi per ad set di step Ad Sets".
- Bid strategy fetch per ad account (existing) tetap; saat ABO jadi *default* yang di-inherit tiap adset.

Step baru **Ad Sets** (sisip antara Audience dan Pixel, HANYA muncul saat ABO):
- List adset cards; tombol `+ Add Ad Set`; minimal 1.
- Per card: `name`, `dailyBudget` (number), optional collapse "Override audience" (reuse komponen geo/age/gender existing), optional "Override bid strategy".
- Footer: total budget = SUM, tampil "Total: Rp X/hari".

Step Creatives saat ABO: tiap creative di-assign ke adset via dropdown (default adset pertama), atau grouping per adset — pilih yang paling sederhana: **dropdown assignment per creative card**. Media picker existing tetap dipakai.

State: tambah `budgetMode`, `adsets: AdsetDraft[]` di FormData. Validasi submit ikut matriks §4. Step indicator dinamis (6 step CBO, 7 step ABO).

---

## 7. Worker Eksternal (repo Hermes, di luar scope eksekusi Sonnet)

Catat di `docs/` + tulis di hasil akhir untuk owner:
- Task type baru `create_full_launch_abo` HARUS diimplement di worker sebelum ABO bisa launch beneran. Sebelum itu, ABO task akan pending di queue (bukan error — by design).
- Logic worker: create campaign (tanpa budget) → loop adsets (create adset dengan `daily_budget` + `bid_strategy` masing-masing) → loop creatives per adset (create creative + ad).
- Partial failure: kalau adset ke-2 gagal, JANGAN rollback adset ke-1 — update task result dengan daftar sukses/gagal per adset, status `partial`, surface ke UI.

---

## 8. Urutan Eksekusi Sonnet (commit per fase, verify per fase)

1. **Schema + migration** — edit schema.prisma (ingat `@map` SEMUA field), tulis migration SQL §3, `npx prisma generate`, `npm run build`. Commit.
2. **POST/GET API** — validasi + transaksi + include adsets. Build. Commit.
3. **Approval payload v2** — builder + taskType branching. Build. Commit.
4. **Wizard UI** — toggle, step Ad Sets, creative assignment. Build. Commit. Push (sekali, fase 1–4 boleh digabung push-nya).
5. **Verify produksi** (lihat §9). Baru boleh klaim DONE.

Aturan: tiap fase `npm run build` hijau dulu. Migration auto-run saat Railway deploy via `start.sh` — **cek deploy logs** `prisma migrate deploy` sukses (pengalaman: pernah silent-fail P3009; kalau terjadi, cek `_prisma_migrations` table, resolve, JANGAN edit migration yang sudah applied).

---

## 9. Acceptance Tests (produksi, wajib semua pass)

```bash
# Login (HATI-HATI: rate limit 120/min — pernah ke-trigger 429 retry-after 840s. Login SEKALI, reuse cookie.)
curl -s -c /tmp/c.txt -X POST https://ai.boytenggara.com/api/admin/auth/login \
  -H "Content-Type: application/json" -d '{"email":"admin@hermes.local","password":"hermes123"}'
```

| # | Test | Expect |
|---|---|---|
| 1 | POST CBO shape lama (tanpa `budgetMode`) | 201, `budgetMode:"CBO"`, creatives flat — **regresi guard** |
| 2 | POST ABO 2 adsets × 2 creatives | 201, GET balikin nested adsets+creatives utuh |
| 3 | POST ABO tanpa `adsets` | 400 |
| 4 | POST ABO + campaign `dailyBudget` terisi | 400 |
| 5 | POST ABO adset `dailyBudget: 0` | 400 |
| 6 | Submit ABO → approve (admin) | workerTask `create_full_launch_abo`, payload v2: campaign TANPA dailyBudget, tiap adset ADA dailyBudget |
| 7 | Submit CBO → approve | workerTask `create_full_launch`, payload punya field flat lama LENGKAP (diff vs payload sebelum perubahan) |
| 8 | DB: `SELECT budget_mode FROM test_launches WHERE id IN (row lama)` | semua `CBO`, tidak ada row korup |

Cleanup row test setelahnya (DELETE via API/psql).

---

## 10. Rollback

- Fase 1–3: `git revert` commit terkait. Migration additive → kolom/tabel nganggur tidak mengganggu (JANGAN drop di produksi).
- Fase 4 (UI): revert commit UI saja, API baru tetap dorman.
- Worker: taskType ABO unknown bagi worker lama = task pending, no side effect.

## 11. Out of Scope (jangan dikerjain sekarang)

- Edit/duplicate adset di TestLaunch existing (detail page) — fase berikutnya
- ABO→CBO conversion untuk launch yang sudah jadi
- Per-adset placement override (placement tetap campaign-level dulu)
- Implementasi worker eksternal (repo lain)
