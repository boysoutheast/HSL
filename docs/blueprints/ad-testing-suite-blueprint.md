# Blueprint: Meta Ads Testing Suite

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION  
**Target files:** prisma/schema.prisma + src/app/api/admin/ad-tests/ + src/app/ads/TestingPage.tsx + src/app/ads/page.tsx  
**Estimasi:** 90–120 menit Sonnet  
**Deps:** TestLaunch, TestLaunchCreative, Cep, LandingPage, MetricSnapshot, CampaignSession, GeneratedMedia

---

## Konteks & Filosofi

Saat campaign naik, advertiser test 3 variabel:
- **Creative** — video/image mana yang CTR/ROAS lebih tinggi
- **CEP** — caption/hook mana yang convert lebih baik (CEP model sudah ada)
- **LP** — landing page mana yang conversion rate lebih tinggi (LandingPage model sudah ada)

**Mental model:** satu Test = satu pertanyaan ("apakah UGC lebih baik dari static?") dengan beberapa Variant sebagai jawabannya. Infra untuk data sudah ada (MetricSnapshot per ad), yang kurang adalah layer Test yang mengikat variant-variant itu jadi satu perbandingan.

**Objective-aware:** setiap test tahu objective-nya (LEADS / ATC / PURCHASE / CPAS) karena KPI yang relevan beda:
- LEADS → sukses metric = CPL (cost per lead)
- ATC → CTR + CPC
- PURCHASE → ROAS
- CPAS → ROAS + purchaseValue (shared item)

---

## 1. Schema Changes (prisma/schema.prisma)

Tambah 2 model baru **di akhir file**, setelah `UserApiKey`:

```prisma
model AdTest {
  id                  String    @id @default(cuid())
  userId              String    @map("user_id")
  campaignSessionId   String?   @map("campaign_session_id")
  testLaunchId        String?   @map("test_launch_id")
  name                String
  type                String    // CREATIVE | CEP | LP | COMBINED
  objective           String    @default("PURCHASE") // LEADS | ATC | PURCHASE | CPAS
  successMetric       String    @map("success_metric") // CTR | CPC | CPL | ROAS | CONV_RATE
  hypothesis          String?   // "UGC akan outperform static karena..."
  status              String    @default("RUNNING") // RUNNING | PAUSED | WINNER_DECLARED | ARCHIVED
  winnerVariantId     String?   @map("winner_variant_id")
  minSpendPerVariant  Decimal?  @map("min_spend_per_variant") @db.Decimal(12,2)
  startedAt           DateTime? @map("started_at")
  endedAt             DateTime? @map("ended_at")
  notes               String?
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")

  user            AdminUser         @relation(fields: [userId], references: [id], onDelete: Cascade)
  campaignSession CampaignSession?  @relation(fields: [campaignSessionId], references: [id], onDelete: SetNull)
  testLaunch      TestLaunch?       @relation(fields: [testLaunchId], references: [id], onDelete: SetNull)
  variants        AdTestVariant[]

  @@map("ad_tests")
}

model AdTestVariant {
  id             String   @id @default(cuid())
  adTestId       String   @map("ad_test_id")
  label          String   // "A" | "B" | "C"
  name           String   // "UGC Video 15s" | "Static Promo" | "CEP Pain Point"
  // Refs ke asset yang ditest (opsional, sesuai type)
  generatedMediaId    String?  @map("generated_media_id")    // Studio output
  testLaunchCreativeId String? @map("test_launch_creative_id") // existing creative
  cepId               String?  @map("cep_id")               // caption/hook
  landingPageId       String?  @map("landing_page_id")       // LP URL
  metaAdId            String?  @map("meta_ad_id")            // actual Meta ad ID untuk sync metrics
  // Denormalized metrics (di-update tiap sync)
  spend          Float    @default(0)
  impressions    Int      @default(0)
  clicks         Int      @default(0)
  leads          Int      @default(0)
  purchases      Int      @default(0)
  purchaseValue  Float    @default(0) @map("purchase_value")
  ctr            Float?
  cpc            Float?
  cpl            Float?
  roas           Float?
  convRate       Float?   @map("conv_rate")
  status         String   @default("running") // running | winner | killed
  lastSyncedAt   DateTime? @map("last_synced_at")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  adTest              AdTest              @relation(fields: [adTestId], references: [id], onDelete: Cascade)
  generatedMedia      GeneratedMedia?     @relation(fields: [generatedMediaId], references: [id], onDelete: SetNull)
  testLaunchCreative  TestLaunchCreative? @relation(fields: [testLaunchCreativeId], references: [id], onDelete: SetNull)
  cep                 Cep?                @relation(fields: [cepId], references: [id], onDelete: SetNull)
  landingPage         LandingPage?        @relation(fields: [landingPageId], references: [id], onDelete: SetNull)

  @@map("ad_test_variants")
}
```

Tambah relasi balik di model yang sudah ada:
```prisma
// Di model CampaignSession — tambah di bagian relations:
adTests  AdTest[]

// Di model TestLaunch — tambah:
adTests  AdTest[]

// Di model GeneratedMedia — tambah:
adTestVariants  AdTestVariant[]

// Di model TestLaunchCreative — tambah:
adTestVariants  AdTestVariant[]

// Di model Cep — tambah:
adTestVariants  AdTestVariant[]

// Di model LandingPage — tambah:
adTestVariants  AdTestVariant[]
```

Setelah edit schema:
```bash
npx prisma migrate dev --name add_ad_tests
npx prisma generate
```

---

## 2. API Endpoints

### `src/app/api/admin/ad-tests/route.ts`

```
GET  /api/admin/ad-tests
  ?status=RUNNING|WINNER_DECLARED|ARCHIVED
  ?type=CREATIVE|CEP|LP
  ?campaignSessionId=X
  → { tests: AdTest & { variants: AdTestVariant[] }[] }

POST /api/admin/ad-tests
  Body: { name, type, objective, successMetric, hypothesis?, campaignSessionId?, testLaunchId?, minSpendPerVariant?, variants: VariantInput[] }
  VariantInput: { label, name, generatedMediaId?, testLaunchCreativeId?, cepId?, landingPageId?, metaAdId? }
  → { test }
```

### `src/app/api/admin/ad-tests/[id]/route.ts`

```
GET    /api/admin/ad-tests/[id]  → { test + variants + campaign/launch context }
PATCH  /api/admin/ad-tests/[id]  → update status/notes/hypothesis
DELETE /api/admin/ad-tests/[id]  → soft delete (status=ARCHIVED)
```

### `src/app/api/admin/ad-tests/[id]/declare-winner/route.ts`

```
POST /api/admin/ad-tests/[id]/declare-winner
  Body: { variantId: string }
  Actions:
    1. Set winnerVariant.status = 'winner'
    2. Set all other variants.status = 'killed'
    3. Set test.status = 'WINNER_DECLARED', test.winnerVariantId, test.endedAt = now()
    4. If winnerVariant.cepId → update Cep.notes dengan append "[Test Winner: {test.name}]"
    5. If winnerVariant.testLaunchCreativeId → update TestLaunchCreative.status = 'winner'
  → { test }
```

### `src/app/api/admin/ad-tests/[id]/sync-metrics/route.ts`

```
POST /api/admin/ad-tests/[id]/sync-metrics
  Untuk setiap variant yang punya metaAdId:
    1. Query MetricSnapshot WHERE metaEntityId = variant.metaAdId ORDER BY windowEnd DESC LIMIT 1
    2. Aggregate: sum spend, impressions, clicks, leads, purchases, purchaseValue
    3. Compute derived: ctr = clicks/impressions, cpc = spend/clicks, cpl = spend/leads,
       roas = purchaseValue/spend, convRate = purchases/clicks
    4. Update variant dengan angka terbaru + lastSyncedAt = now()
  → { synced: number, variants: updated[] }
```

---

## 3. UI: TestingPage

**File:** `src/app/ads/TestingPage.tsx` (client component)

### Layout (satu halaman, vertikal)

```
┌─────────────────────────────────────────────────────┐
│ [+ New Test]                    Filter: [All ▾] [Type ▾] │
├─────────────────────────────────────────────────────┤
│ RUNNING TESTS                                       │
│ ┌───────────────────────────────────────────────┐  │
│ │ 🧪 UGC vs Static — CREATIVE · PURCHASE        │  │
│ │ Campaign: Produk X · Hipotesis: ...           │  │
│ │                                               │  │
│ │  [A] UGC 15s           [B] Static Promo       │  │
│ │  Spend: Rp 150k        Spend: Rp 148k         │  │
│ │  CTR: 3.2%             CTR: 1.8%              │  │
│ │  ROAS: 2.8             ROAS: 1.4              │  │
│ │  ████████████░░        ████░░░░░░░░           │  │
│ │                                               │  │
│ │  [Sync Metrics]  [Declare Winner]  [Archive]  │  │
│ └───────────────────────────────────────────────┘  │
│                                                     │
│ COMPLETED                                           │
│ [collapsed, klik expand]                           │
└─────────────────────────────────────────────────────┘
```

### New Test Drawer (slide-in dari kanan, bukan modal penuh)

3 langkah dalam satu drawer:

**Step 1 — Setup**
```
Nama test: [________________]
Tipe:   [Creative] [CEP] [LP] [Combined]
Objective: [Leads] [ATC] [Purchase] [CPAS]
Success metric: auto-select berdasarkan objective, bisa override
  - Leads → CPL
  - ATC → CTR
  - Purchase → ROAS
  - CPAS → ROAS
Hipotesis: [textarea — opsional]
Attach ke: Campaign [dropdown] atau Test Launch [dropdown]
```

**Step 2 — Variants**
```
[+ Add Variant]  (min 2, max 4)

Variant A:
  Label: [A]  Nama: [________________]
  Tipe CREATIVE → picker: Studio/Library/Upload
  Tipe CEP → dropdown dari Cep model (filter by product)
  Tipe LP → dropdown dari LandingPage model
  Meta Ad ID: [________________] (opsional, untuk auto-sync)

Variant B: [sama]
```

**Step 3 — Confirm**
```
Summary: test.name, type, objective, variants count
[Launch Test]
```

### Test Card (per test, di list)

- Header: nama test, badge type, badge objective, badge status
- Variant comparison: side-by-side, per variant tampilkan:
  - Nama + asset preview (thumbnail kalau creative, text kalau CEP, URL kalau LP)
  - Metrics yang relevan (berdasarkan successMetric):
    - ROAS → spend, roas, purchases
    - CPL → spend, cpl, leads
    - CTR → impressions, ctr, clicks
  - Progress bar relative (A vs B — siapa lead)
  - Status badge: running / winner / killed
- Footer: tombol Sync Metrics, Declare Winner (disabled kalau sudah WINNER_DECLARED), Archive

### Winner Declaration Modal

```
Pilih pemenang:
○ Variant A — [nama] (ROAS 2.8)
○ Variant B — [nama] (ROAS 1.4)

[✓] Simpan CEP winner ke Cep library  (muncul kalau type=CEP atau Combined)
[✓] Update status creative ke 'winner' (muncul kalau ada testLaunchCreativeId)

[Declare Winner]
```

---

## 4. Integration ads/page.tsx

Tambah tab ketiga:

```tsx
const tabs = [
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'testing', label: 'Testing' },
  { id: 'rules', label: 'Rules' },
]
```

```tsx
import TestingPage from './TestingPage'

panels={{
  campaigns: (...),
  testing: <TestingPage />,
  rules: (...),
}}
```

TAB_ALIAS tambah:
```ts
const TAB_ALIAS = {
  launch: 'campaigns',
  monitor: 'campaigns',
  actions: 'rules',
  // test sudah jadi 'testing' langsung
}
```

---

## 5. Metric Display Logic (per objective)

```ts
function getDisplayMetrics(objective: string, variant: AdTestVariant) {
  switch (objective) {
    case 'LEADS':
      return [
        { label: 'CPL', value: fmt(variant.cpl, 'currency') },
        { label: 'Leads', value: variant.leads },
        { label: 'Spend', value: fmt(variant.spend, 'currency') },
      ]
    case 'ATC':
      return [
        { label: 'CTR', value: fmt(variant.ctr, 'percent') },
        { label: 'CPC', value: fmt(variant.cpc, 'currency') },
        { label: 'Clicks', value: variant.clicks },
      ]
    case 'PURCHASE':
    case 'CPAS':
      return [
        { label: 'ROAS', value: fmt(variant.roas, 'decimal') },
        { label: 'Purchases', value: variant.purchases },
        { label: 'Spend', value: fmt(variant.spend, 'currency') },
      ]
    default:
      return [
        { label: 'CTR', value: fmt(variant.ctr, 'percent') },
        { label: 'CPC', value: fmt(variant.cpc, 'currency') },
      ]
  }
}
```

---

## 6. Aturan Wajib

- Semua fetch pakai `credentials: 'include'`
- Semua route pakai `requireAuth` dari `@/lib/auth`
- Tidak ada import server-only di client component
- `prisma` dari `@/lib/prisma`
- tsc --noEmit 0 error dari file baru (pre-existing error di file lain boleh)
- Setelah migrate: jalankan `npx prisma generate` sebelum run build
- No force-push ke main
- Commit setelah selesai + verified
- JANGAN claim done sebelum: (1) tsc clean, (2) `/ads?tab=testing` bisa dibuka tanpa error

---

## 7. Execution Order

```
1. Edit prisma/schema.prisma — tambah AdTest + AdTestVariant + relasi balik
2. npx prisma migrate dev --name add_ad_tests
3. npx prisma generate
4. Tulis src/app/api/admin/ad-tests/route.ts (GET + POST)
5. Tulis src/app/api/admin/ad-tests/[id]/route.ts (GET + PATCH + DELETE)
6. Tulis src/app/api/admin/ad-tests/[id]/declare-winner/route.ts
7. Tulis src/app/api/admin/ad-tests/[id]/sync-metrics/route.ts
8. Tulis src/app/ads/TestingPage.tsx (full client component)
9. Edit src/app/ads/page.tsx — tambah tab 'testing'
10. npx tsc --noEmit — fix semua error di file baru
11. git add + commit + push
12. Lapor: endpoint list, contoh payload POST /api/admin/ad-tests, screenshot mental model UI
```

---

## 8. Payload Contoh

```json
POST /api/admin/ad-tests
{
  "name": "UGC vs Static — Produk Vitamin C",
  "type": "CREATIVE",
  "objective": "PURCHASE",
  "successMetric": "ROAS",
  "hypothesis": "UGC 15 detik akan lebih tinggi ROAS karena lebih relatable untuk audience ibu 25-40",
  "campaignSessionId": "clxabc123...",
  "minSpendPerVariant": 50000,
  "variants": [
    {
      "label": "A",
      "name": "UGC 15s — Unboxing",
      "generatedMediaId": "clxvid001...",
      "metaAdId": "120208550000123456"
    },
    {
      "label": "B",
      "name": "Static Promo — Diskon 30%",
      "testLaunchCreativeId": "clxcreative001...",
      "metaAdId": "120208550000789012"
    }
  ]
}
```
