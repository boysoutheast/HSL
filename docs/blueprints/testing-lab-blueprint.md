# Blueprint: Testing Lab (HSL) — KONSOLIDASI

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION · Tanggal: 2026-06-30
**Eksekutor:** Sonnet VPS (endless, semua segmen) · **Auditor final:** Fable (1× audit total di akhir)
**SUPERSEDES:** `docs/blueprints/ad-testing-suite-blueprint.md` (didesain, tidak pernah dibangun — JANGAN eksekusi file itu, semua isinya sudah diserap ke sini)

---

## 0. TUJUAN & IDENTITAS

HSL = **direct-response ad testing loop dengan otak otomasi.** Bukan note-app, bukan memory layer.
Spine produk: **Library → Studio → Testing Lab → Rules → Dashboard.**

```
📦 Library  →  🎨 Studio  →  🧪 Testing Lab  →  🚀 Rules  →  🏠 Dashboard
  bahan        bikin          jalanin test         auto-scale     pantau
              creative        LIHAT PEMENANG       pemenang        loop
```

**Lubang inti yang ditutup (dikonfirmasi audit):** HSL sekarang TIDAK punya layar manapun yang menampilkan "varian A vs B, A menang di metrik X". `MetricSnapshot` per-ad, tidak per-varian, tidak ditampilkan. Testing Lab = layar winner-readback itu.

**Mental model:** 1 Test = 1 pertanyaan ("UGC vs Static?"). Beberapa Variant = jawabannya. Variabel yang diuji: **Creative · CEP/Angle · Landing Page · Price**. User menentukan "menang itu apa" (pilih metrik), sistem yang ranking + scale.

**CPAS: DIPARKIR** — hide dari nav, stop diwiring, model CPAS dibiarkan dorman (JANGAN delete). Field `track` default `DIRECT` agar CPAS bisa dihidupkan additive nanti.

---

## 1. ATURAN GLOBAL (BERLAKU SEMUA SEGMEN — WAJIB)

1. Branch `main`. Sebelum mulai TIAP segmen: `git pull --rebase origin main`.
2. `npx tsc --noEmit` = 0 error dari file yang kamu sentuh, SEBELUM commit. (Pre-existing error di file lain — misal `driver.js` di `useTour.ts` — boleh diabaikan, tapi sebut di report.)
3. Migration **additive only**: semua field baru wajib `?` (nullable) atau punya `@default`. DILARANG drop kolom / drop tabel. Sebelum migrate: `cp prisma/schema.prisma prisma/schema.prisma.bak`.
4. Semua route admin: `requireAuth` dari `@/lib/auth`. Semua fetch client: `credentials: 'include'`. `prisma` dari `@/lib/prisma`. Tidak ada import server-only di client component.
5. Sebelum tulis file baru: baca 1 file pattern sejenis dulu (auth, prisma query, response shape) — ikuti gaya yang ada.
6. **Hermes API utuh.** Jangan ubah lifecycle/akses `Cep`, `LandingPage`, `PhotoReference`, `MediaAsset` yang dipakai `/api/hermes/*`. AdTestVariant hanya MEREFERENSI entity, tidak memiliki.
7. **Zero-worker.** DILARANG `prisma.workerTask.create(...)`. Kalau nemu jalur yang masih bikin WorkerTask (lihat Segmen 8), konversi ke direct.
8. **GUARDRAIL KREDENSIAL:** DILARANG reset/ubah password atau kredensial production. DILARANG dump secret/hash ke disk/`/tmp`. DILARANG taruh credential di code/log/commit. Pakai akun login yang sudah ada untuk smoke test.
9. **ANTI-FABRIKASI:** DILARANG mengarang commit hash. Setiap klaim commit harus disertai output asli `git rev-parse HEAD` dan `git log --oneline -1`. Setiap klaim "grep 0" harus sertakan command + output mentahnya.
10. No force-push ke main. Konflik → `git pull --rebase`.
11. Tiap segmen selesai → commit + push + tulis **SONNET REPORT** (format di §11) → update **SEGMENT LEDGER** (§2) di file ini (commit perubahan ledger-nya juga).

---

## 2. SEGMENT LEDGER (Sonnet update kolom Status + Commit tiap selesai)

| # | Segmen | Status | Commit | Catatan |
|---|--------|--------|--------|---------|
| 1 | Foundation schema (AdTest, AdTestVariant, OfferVariant, landingPageViews, track) | DONE | a689483 | migrate + generate + tsc 0 error |
| 2 | AdTest API (CRUD + declare-winner + sync-metrics) | DONE | 8b59f31 | 5 routes + lib, tsc 0, migrate additive |
| 3 | Nav re-spine + Design System + CPAS takedown | DONE | bde879f | sidebar re-spine + Library sub-links, CPAS hidden from nav |
| 4 | Testing Lab UI (variant compare + metric picker = winner readback) | DONE | f5f53f0 | TestingPage: list, metric dropdown, side-by-side, drawer, winner modal |
| 5 | Creative tester + Studio gen→asset autolink | DONE | 614f621 | webhook autolink + create-creative route + creative text input in drawer |
| 6 | CEP tester + Price tester (OfferVariant) | DONE | f3c7000 | OfferVariant CRUD APIs + CEP/LP/PRICE inputs in drawer |
| 7 | Ruling loop (TEST_OUTCOME signal → auto-scale winner) | DONE | 0974eb2 | TEST_OUTCOME condition + AutomationAction on declare-winner |
| 8 | Dashboard surfacing + onboarding + zero-worker verify | DONE | 2288ede | tes berjalan + winner widgets + onboarding item + zero-worker grep pass |
| 9 | Scale templates (seed 5) + template picker UI (lengkapi Fase 6) | DONE | a8e5c4a | +Scale Test Winner template, 13 builtin, picker via rules editor |
| 10 | Phase affordance (transisi + suggest) + Import UX (create-menu, importStatus) | TODO | — | |

Status: `TODO` → `DOING` → `DONE` (atau `BLOCKED: alasan`).
Urutan WAJIB berurutan (1→10). Segmen N+1 boleh mulai hanya jika N = DONE.
Segmen 9–10 = modul "add existing campaign → scale/maintain"; melengkapi `docs/blueprints/testing-scaling-automation-blueprint.md` (Fase 1–5 sudah BUILT, Fase 6 belum). JANGAN eksekusi blueprint itu terpisah — Fase 6-nya diserap ke Segmen 9.

---

## 3. SEGMEN 1 — Foundation Schema

**Objective:** Tambah model inti + field pendukung. Migration additive.

**Edit `prisma/schema.prisma` — tambah di akhir file (setelah `UserApiKey`):**

```prisma
model AdTest {
  id                  String    @id @default(cuid())
  userId              String    @map("user_id")
  productId           String?   @map("product_id")
  campaignSessionId   String?   @map("campaign_session_id")
  testLaunchId        String?   @map("test_launch_id")
  name                String
  type                String    // CREATIVE | CEP | LP | PRICE | COMBINED
  objective           String    @default("PURCHASE") // LEADS | ATC | PURCHASE
  successMetric       String    @map("success_metric") // ROAS|CPM|CPLC|CPL|CPC|CTR|COST_PER_LPV|CVR|CPA — user pilih
  hypothesis          String?
  status              String    @default("RUNNING") // RUNNING | PAUSED | WINNER_DECLARED | ARCHIVED
  winnerVariantId     String?   @map("winner_variant_id")
  minSpendPerVariant  Decimal?  @map("min_spend_per_variant") @db.Decimal(12,2)
  track               String    @default("DIRECT") // DIRECT | CPAS (CPAS dorman)
  autoScaleWinner     Boolean   @default(false) @map("auto_scale_winner") // dipakai Segmen 7
  startedAt           DateTime? @map("started_at")
  endedAt             DateTime? @map("ended_at")
  notes               String?
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")

  user            AdminUser         @relation(fields: [userId], references: [id], onDelete: Cascade)
  product         Product?          @relation(fields: [productId], references: [id], onDelete: SetNull)
  campaignSession CampaignSession?  @relation(fields: [campaignSessionId], references: [id], onDelete: SetNull)
  testLaunch      TestLaunch?       @relation(fields: [testLaunchId], references: [id], onDelete: SetNull)
  variants        AdTestVariant[]

  @@index([userId])
  @@index([status])
  @@map("ad_tests")
}

model AdTestVariant {
  id                   String   @id @default(cuid())
  adTestId             String   @map("ad_test_id")
  label                String   // "A" | "B" | "C"
  name                 String
  // Refs polimorfik ke yang ditest (isi sesuai type)
  generatedMediaId     String?  @map("generated_media_id")
  testLaunchCreativeId String?  @map("test_launch_creative_id")
  creativeVariantId    String?  @map("creative_variant_id")
  cepId                String?  @map("cep_id")
  landingPageId        String?  @map("landing_page_id")
  offerVariantId       String?  @map("offer_variant_id")
  metaAdId             String?  @map("meta_ad_id") // untuk sync metrics dari MetricSnapshot
  // COUNTER MENTAH (di-update tiap sync) — semua metrik diturunkan dari sini
  spend                Float    @default(0)
  impressions          Int      @default(0)
  clicks               Int      @default(0)
  linkClicks           Int      @default(0) @map("link_clicks")
  landingPageViews     Int      @default(0) @map("landing_page_views")
  leads                Int      @default(0)
  purchases            Int      @default(0)
  revenue              Float    @default(0)
  // Derived cache (dihitung saat sync, biar UI ringan)
  ctr                  Float?
  cpc                  Float?
  cpl                  Float?
  cplc                 Float?
  cpm                  Float?
  roas                 Float?
  convRate             Float?   @map("conv_rate")
  costPerLpv           Float?   @map("cost_per_lpv")
  status               String   @default("running") // running | winner | killed
  lastSyncedAt         DateTime? @map("last_synced_at")
  createdAt            DateTime @default(now()) @map("created_at")
  updatedAt            DateTime @updatedAt @map("updated_at")

  adTest              AdTest              @relation(fields: [adTestId], references: [id], onDelete: Cascade)
  generatedMedia      GeneratedMedia?     @relation(fields: [generatedMediaId], references: [id], onDelete: SetNull)
  testLaunchCreative  TestLaunchCreative? @relation(fields: [testLaunchCreativeId], references: [id], onDelete: SetNull)
  creativeVariant     CreativeVariant?    @relation(fields: [creativeVariantId], references: [id], onDelete: SetNull)
  cep                 Cep?                @relation(fields: [cepId], references: [id], onDelete: SetNull)
  landingPage         LandingPage?        @relation(fields: [landingPageId], references: [id], onDelete: SetNull)
  offerVariant        OfferVariant?       @relation(fields: [offerVariantId], references: [id], onDelete: SetNull)

  @@index([adTestId])
  @@map("ad_test_variants")
}

model OfferVariant {
  id          String   @id @default(cuid())
  productId   String   @map("product_id")
  label       String   // "Rp99k", "Bundle 2", "Diskon 30%"
  price       Decimal  @db.Decimal(12,2)
  description String?
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  product        Product         @relation(fields: [productId], references: [id], onDelete: Cascade)
  adTestVariants AdTestVariant[]

  @@index([productId])
  @@map("offer_variants")
}
```

**Tambah relasi balik (di model existing):**
- `AdminUser`: `adTests AdTest[]`
- `Product`: `adTests AdTest[]` dan `offerVariants OfferVariant[]`
- `CampaignSession`: `adTests AdTest[]`
- `TestLaunch`: `adTests AdTest[]`
- `GeneratedMedia`: `adTestVariants AdTestVariant[]`
- `TestLaunchCreative`: `adTestVariants AdTestVariant[]`
- `CreativeVariant`: `adTestVariants AdTestVariant[]`
- `Cep`: `adTestVariants AdTestVariant[]`
- `LandingPage`: `adTestVariants AdTestVariant[]`

**Juga (untuk Segmen 5 — Studio autolink):** tambah di `GeneratedMedia`:
```prisma
  mediaAssetId String? @unique @map("media_asset_id")
  mediaAsset   MediaAsset? @relation(fields: [mediaAssetId], references: [id], onDelete: SetNull)
```
dan di `MediaAsset`: `generatedMedia GeneratedMedia?`

**Jalankan:**
```bash
cp prisma/schema.prisma prisma/schema.prisma.bak
npx prisma migrate dev --name add_testing_lab
npx prisma generate
```

**Acceptance:** migrate sukses, `npx prisma generate` clean, `npx tsc --noEmit` 0 error baru. Hapus `prisma/schema.prisma.bak` setelah verified.

**Audit segmen (MAC checklist):** model muncul di schema? migration file ada? prisma client kenal `prisma.adTest`? back-relation gak bikin error relasi? Catat nama migration file.

---

## 4. SEGMEN 2 — AdTest API

**Files:** `src/app/api/admin/ad-tests/route.ts`, `[id]/route.ts`, `[id]/declare-winner/route.ts`, `[id]/sync-metrics/route.ts`.

**`route.ts`:**
- `GET ?status=&type=&campaignSessionId=&productId=` → `{ tests: (AdTest & { variants })[] }`, filter `userId` = user login.
- `POST` body `{ name, type, objective, successMetric, hypothesis?, productId?, campaignSessionId?, testLaunchId?, minSpendPerVariant?, autoScaleWinner?, variants: VariantInput[] }`. VariantInput `{ label, name, generatedMediaId?, testLaunchCreativeId?, creativeVariantId?, cepId?, landingPageId?, offerVariantId?, metaAdId? }`. Set `startedAt=now()`, `status=RUNNING`.

**`[id]/route.ts`:** GET (test+variants+konteks), PATCH (status/notes/hypothesis/successMetric/autoScaleWinner), DELETE (soft → `status=ARCHIVED`). Semua cek ownership `userId`.

**`[id]/declare-winner/route.ts`:** POST `{ variantId }` →
1. winner variant `status='winner'`, sisanya `status='killed'`
2. test `status='WINNER_DECLARED'`, `winnerVariantId`, `endedAt=now()`
3. kalau winner `cepId` → append `Cep.notes` "[Test Winner: {name}]"
4. kalau winner `testLaunchCreativeId` → `TestLaunchCreative.status='winner'`
5. **return field `autoScaleWinner`** (Segmen 7 yang konsumsi)

**`[id]/sync-metrics/route.ts`:** POST → untuk tiap variant ber-`metaAdId`:
1. ambil `MetricSnapshot` WHERE `metaEntityId=variant.metaAdId` ORDER BY `windowEnd` DESC (agregasi terbaru)
2. update counter mentah: `spend, impressions, clicks, linkClicks, landingPageViews?, leads, purchases, revenue` (revenue ← `purchaseValue`)
   - catatan: kalau `landingPageViews` belum ada di MetricSnapshot, biarkan 0 + catat di report (butuh field baru di MetricSnapshot — lihat catatan bawah)
3. hitung derived: `ctr=clicks/impressions`, `cpc=spend/clicks`, `cpl=spend/leads`, `cplc=spend/linkClicks`, `cpm=spend/impressions*1000`, `roas=revenue/spend`, `convRate=purchases/clicks`, `costPerLpv=spend/landingPageViews` (guard pembagian 0 → null)
4. `lastSyncedAt=now()`

> **Metric catalog helper** `src/lib/test-metrics.ts`: fungsi `deriveMetrics(counters)` → object semua derived, dan `rankVariants(variants, successMetric)` → urutkan + tandai pemimpin. Lower-is-better untuk CPC/CPL/CPLC/CPM/CPA/COST_PER_LPV; higher-is-better untuk ROAS/CTR/CVR.

> **Catatan landingPageViews:** kalau `MetricSnapshot` belum punya kolom `landingPageViews`/`landing_page_views`, tambahkan (nullable, additive) di Segmen ini + isi dari Meta Insights field `landing_page_views` di cron `scan-campaigns` (kalau mudah). Kalau berisiko, SKIP + catat sebagai gap di report (cost-per-LPV jadi null sampai diisi).

**Acceptance:** `POST /api/admin/ad-tests` bikin test+variants; `GET` balikin; `declare-winner` ubah status; `sync-metrics` isi angka. tsc clean. Sertakan contoh payload + response di report.

---

## 5. SEGMEN 3 — Nav Re-spine + Design System + CPAS Takedown

**Objective:** fitur "ke-show-up". Spine job-oriented, halaman orphan masuk nav, CPAS disembunyikan.

**`src/components/Sidebar.tsx`** — susun pilar:
```
🏠 Dashboard            /
🧪 Testing Lab          /ads?tab=testing   (atau /testing kalau dibuat — lihat Segmen 4)
🚀 Campaigns            /ads
🎨 Studio               /media
📦 Library              /products  (+ sub: Characters, Topics, CEPs, Photos)
🔗 Akun Meta            /meta-connections
✅ Approvals            /approval-requests
⚙️ System               /system
```
- Tambah link yang sebelumnya orphan: **Products, CEPs, Characters, Topics** (boleh sebagai sub-item Library, atau link langsung). Minimal Products & CEPs WAJIB punya entry jelas.
- **CPAS takedown:** sembunyikan elemen nav/tab/section yang khusus CPAS (catalog, product set, cpas diary/graveyard). JANGAN hapus route/model — cukup hilangkan dari nav + jangan render. Bila ada page `/media-library`/`/media-rules` yang campur CPAS, biarkan tapi tanpa entry CPAS.

**Shared UI** (reuse yang ada): `PageInfo` (header "ini buat apa + langkah"), `EmptyState` (dengan CTA "next action", bukan cuma teks). Tambah `EmptyState` dengan tombol aksi di tiap halaman tester kosong.

**Acceptance:** tiap halaman penting punya entry di Sidebar (tidak ada lagi fitur yang cuma reachable via URL manual). Tidak ada link/tab CPAS yang tampil. tsc + build clean.

---

## 6. SEGMEN 4 — Testing Lab UI (winner readback)

**File:** `src/app/ads/TestingPage.tsx` + daftarkan tab `testing` di `src/app/ads/page.tsx` (`tabs: [campaigns, testing, rules]`, import `TestingPage`, alias lama tetap).
(Opsional: kalau mau pilar terpisah, buat `src/app/testing/page.tsx` yang render `TestingPage` — koordinasikan dengan link Segmen 3.)

**Layout:** list test (RUNNING di atas, COMPLETED collapsed). Tiap **Test Card**:
- Header: nama, badge type, badge objective, badge status, **dropdown `successMetric`** (user ganti metrik winner kapan saja → ranking ikut berubah).
- Variant compare **side-by-side**: preview (thumbnail creative / teks CEP / URL LP / harga offer) + metrik relevan (lihat `getDisplayMetrics` di bawah) + progress bar relatif (siapa mimpin di `successMetric`) + badge running/winner/killed.
- Footer: `Sync Metrics`, `Declare Winner` (disabled kalau `WINNER_DECLARED`), `Archive`.

**New Test Drawer** (slide-in kanan, 3 step): Setup (nama/type/objective/successMetric default-by-objective tapi override/product/campaign/hypothesis) → Variants (min 2 max 4; picker sesuai type: CREATIVE→Studio/Library, CEP→dropdown Cep by product, LP→dropdown LandingPage, PRICE→dropdown OfferVariant; field metaAdId opsional) → Confirm.

**Winner modal:** pilih pemenang (tampil nilai successMetric tiap varian), checkbox "Simpan CEP winner ke library" (kalau type CEP/COMBINED), checkbox "tandai creative winner".

**`getDisplayMetrics(successMetric, variant)`** — tampilkan 3 metrik paling relevan dengan `successMetric` di urutan teratas (mis. successMetric=ROAS → ROAS, purchases, spend; =CPL → CPL, leads, spend; =CTR → CTR, clicks, impressions; =COST_PER_LPV → costPerLpv, landingPageViews, spend). Semua diturunkan dari counter via `src/lib/test-metrics.ts`.

**Acceptance:** `/ads?tab=testing` kebuka tanpa error; bisa bikin test 2 varian; tabel compare tampil; ganti dropdown metrik → ranking/progress berubah; declare winner jalan. tsc + build clean. Sertakan deskripsi UI + nama metrik di report.

---

## 7. SEGMEN 5 — Creative Tester + Studio gen→asset autolink

**A. Autolink (tutup gap kritikal gen→creative):**
- Saat `GeneratedMedia` jadi `completed` (di webhook `/api/hermes/generate/video/webhook` dan/atau cron `poll-geminigen`): otomatis buat `MediaAsset` (`source='AI_GENERATED'`, `type` sesuai `mediaType`, `publicUrl=videoUrl`, `thumbnailUrl`, `generationPrompt=prompt`, `userId`) lalu set `GeneratedMedia.mediaAssetId`. Idempotent (cek kalau sudah ada, skip).
- Studio (`/media`) Library tab: tampilkan asset hasil generate, tombol "Jadikan Creative" → bikin `CreativeVariant` dari `MediaAsset` (mediaAssetId, default copy/CTA kosong, status DRAFT).

**B. Creative tester:** di New Test Drawer type=CREATIVE, picker varian dari `GeneratedMedia` (Studio) ATAU `CreativeVariant`/`TestLaunchCreative` (Library). Variant simpan ref yang sesuai.

**Acceptance:** generate selesai → `MediaAsset` + `mediaAssetId` keisi otomatis (verifikasi via DB/readback satu record). "Jadikan Creative" bikin `CreativeVariant`. Creative test bisa dibuat. tsc clean.

---

## 8. SEGMEN 6 — CEP Tester + Price Tester

**CEP tester:** type=CEP, varian ref `cepId` (dropdown Cep by product). Declare-winner → append ke `Cep.notes` (sudah di Segmen 2). Pastikan picker filter Cep milik user/produk.

**Price tester (BARU):**
- API `src/app/api/admin/products/[id]/offer-variants/route.ts` (GET/POST) + `src/app/api/admin/offer-variants/[id]/route.ts` (PATCH/DELETE). Ownership via `product.createdByUserId`.
- UI: di Product detail tambah tab/section "Offers" (CRUD OfferVariant) ATAU langsung di New Test Drawer type=PRICE (bikin offer inline). Minimal: bisa bikin 2+ OfferVariant lalu jadiin varian test type=PRICE.
- Catatan: harga di iklan direct biasanya beda LP/creative; test PRICE membandingkan performa creative/LP yang mengusung harga berbeda. Variant PRICE boleh juga set `landingPageId`/`creativeVariantId` pendamping.

**Acceptance:** bisa bikin OfferVariant; bikin test type=PRICE 2 varian; compare tampil. CEP test jalan + winner kesimpan ke Cep. tsc clean.

---

## 9. SEGMEN 7 — Ruling Loop (test → auto-scale)

**Objective:** declare-winner bisa memicu rule scaling. Tutup gap "rule buta sama hasil test".

1. **Sinyal baru di rule engine** (`src/lib/rule-engine.ts` + `scan-campaigns`): tambah condition type `TEST_OUTCOME` → `{ type:'TEST_OUTCOME', adTestId, expect:'WINNER_DECLARED' }`. Saat evaluasi, true kalau `AdTest.status='WINNER_DECLARED'`. Masukkan `winning_variant_meta_ad_id` ke metricsMap dari `winnerVariant.metaAdId`.
2. **declare-winner → aksi (jika `autoScaleWinner=true`):** buat `AutomationAction` (`source='SYSTEM'`, `actionType='UPDATE_BUDGET'`) untuk adset/ad pemenang (naikkan budget pakai multiplier default, mis. 1.3) DAN/ATAU `PAUSE_ADSET` untuk varian killed yang punya `metaAdId`. Action `status=PENDING` → dieksekusi inline oleh executor existing (lihat pola `scan-campaigns`/`AutomationAction`). JANGAN bikin worker.
   - Kalau eksekusi langsung berisiko, cukup buat `AutomationAction` PENDING + tampilkan di Action Center / decision queue (manusia approve). Sebutkan pilihan yang diambil di report.
3. **Rule builder UI** (`/rules-editor`): tambah template "Scale Test Winner" yang pakai condition `TEST_OUTCOME`.

**Acceptance:** declare-winner dengan `autoScaleWinner=true` menghasilkan `AutomationAction` yang benar (verifikasi record). Rule `TEST_OUTCOME` bisa dibuat + evaluasi tidak error di cron. Tidak ada `workerTask.create`. tsc clean.

---

## 10. SEGMEN 8 — Dashboard Surfacing + Onboarding + Zero-Worker Verify

1. **Dashboard (`src/app/page.tsx`):** tambah widget "Tes Berjalan" (RUNNING AdTest + pemimpin sementara) dan "Winner Terbaru" (WINNER_DECLARED terakhir). Onboarding checklist: tambah item "Jalankan test pertama".
2. **Onboarding flow:** pastikan jalur Library→Studio→Testing Lab→Rules ada petunjuk next-step di EmptyState tiap halaman (mis. dashboard kosong → "Buat produk dulu" link).
3. **Zero-worker verify:** grep `workerTask.create` / `prisma.workerTask` di `src/app/api/admin/generate/*`, `media-assets/generate`, `api/gen/*`. Kalau ADA yang masih bikin WorkerTask untuk generate → konversi ke pemanggilan direct ke service gen (pola seperti pemanggilan geminigen yang sudah ada). Kalau TIDAK ada (audit inference stale) → no-op + catat hasil grep mentah di report.
4. **Wire `landing_page_views` (UTANG dari Segmen 2):** field `MetricSnapshot.landingPageViews` sudah ada tapi BELUM diisi cron → metrik `COST_PER_LPV` mati. Di `scan-campaigns` (dan `getInsights`/insight fetch): tambah `landing_page_views` ke fields yang diminta dari Meta Insights, lalu isi ke `MetricSnapshot.landingPageViews` saat upsert. Guard null kalau Insights tidak mengembalikan field itu untuk objective tertentu. Setelah ini, `sync-metrics` (Segmen 2) otomatis dapat angka LPV.

**Acceptance:** dashboard nampilin tes berjalan + winner; grep zero-worker dilampirkan (mentah) di report; `landing_page_views` terisi di MetricSnapshot (verifikasi 1 record atau sebut kalau belum ada campaign live); kalau ada konversi worker, smoke generate masih jalan. tsc + build clean.

---

## 10b. SEGMEN 9 — Scale Templates + Template Picker UI (lengkapi Fase 6)

**Konteks:** Modul import campaign + scaling engine SUDAH ada (import wizard, cron `sync-campaigns`, `scan-campaigns` dengan anti-overscale guard +50%/hari, `MetricSnapshot` harian, temporal metrics). Yang KURANG: template rule siap-pakai + cara user attach tanpa nulis JSON. Sumber kondisi template = `testing-scaling-automation-blueprint.md` Fase 6.

**A. Seed 5 built-in `RuleTemplate`** (via `prisma/seed.ts` atau seed route idempotent — cek dulu pola seed existing). `isBuiltin=true`. Condition tree (sesuaikan field name dgn `rule-engine.ts` aktual):
1. **Kill Loser** — `AND[ spend>10000, purchases==0 ]` → `PAUSE_ADSET`
2. **Scale Winner Vertical** — `AND[ roas>=1.5, purchases>=5, adset_age_days>=7 ]` → `UPDATE_BUDGET increase_pct 20`
3. **Fatigue Guard** — `frequency>3.5` → `UPDATE_BUDGET decrease_pct 20`
4. **Scale-Ready Gate** — `AND[ roas_min_7d>=1.5, purchases>=5, frequency<3.5, cpa_change_pct_3d<=20 ]` → `NOTIFY`
5. **Kill Boros** — `AND[ spend>30000, roas<1 ]` → `PAUSE_ADSET`
6. **Scale Test Winner** (sambungan Segmen 7) — condition `TEST_OUTCOME { adTestId, expect:'WINNER_DECLARED' }` → `UPDATE_BUDGET increase_pct 30` ke `winnerVariant.metaAdId`.

**B. Template picker UI** di campaign detail Automation tab (`src/app/campaign-monitor/[id]/...`): list template **human-readable** (kondisi + aksi dalam bahasa manusia, BUKAN JSON), tombol **Attach** → POST `/api/admin/campaign-sessions/[id]/rules` dari template. Tampilkan threshold yang bisa di-override (mis. ROAS target, spend cap).

**Acceptance:** 5–6 template ke-seed (verifikasi via query); picker nampilin readable; attach bikin `AutomationRule`; tidak ada user yang perlu nulis JSON mentah. tsc clean. Sertakan list template + 1 contoh attach di report.

---

## 10c. SEGMEN 10 — Phase Affordance + Import UX

**Objective:** phase berhenti jadi pajangan; import gampang ke-discover; status sync kelihatan. SEMUA additive/non-breaking — JANGAN hard-gate rule existing by phase (rule yang sudah attached harus tetap jalan).

1. **Phase transition UI** (`campaign-monitor/[id]`): dropdown/tombol `TESTING → SCALING → MAINTENANCE → EXITED` → PATCH `phase` (route sudah terima `phase`). Tampilkan badge phase yang editable.
2. **Phase-suggested templates** (soft, bukan gate): di picker Segmen 9, kalau `phase=SCALING` highlight Scale Winner/Scale-Ready; `phase=TESTING` highlight Kill Loser/Kill Boros/Scale Test Winner. Cuma urutan/highlight — semua template tetap bisa dipilih.
3. **Import di create-menu** (`src/components/Sidebar.tsx`): tambah shortcut "Import Campaign" → `/campaign-monitor/import` (sekarang cuma ada New Launch + Upload Media).
4. **importStatus surfaced**: di `campaign-monitor/[id]` + list monitor, tampilkan badge `Syncing… / Sync gagal / Synced` dari `CampaignSession.importStatus`. Kalau `sync_failed`, kasih tombol retry (panggil ulang sync).

**Acceptance:** bisa ganti phase dari UI (verifikasi PATCH); "Import Campaign" muncul di create-menu; badge importStatus tampil; highlight template ngikut phase. tsc + build clean.

---

## 11. SONNET REPORT (format wajib tiap segmen — kirim ke Mac/Fable)

```
## SONNET REPORT — Segmen N: [judul]
Commit: <git rev-parse HEAD>           ← paste output asli
git log -1: <git log --oneline -1>     ← paste output asli
Branch sync: <git rev-parse origin/main>

### Yang dikerjakan
- file dibuat/diubah (path) + 1 baris fungsi

### Acceptance (bukti)
- tsc: <tail output `npx tsc --noEmit`>
- build (kalau relevan): <tail `npm run build`>
- contoh request/response / readback record / grep mentah

### MAC Audit (self)
1. Objective vs hasil — kejawab? gap?
2. Side-effect / dependency kesentuh?
3. Asumsi yang belum kebukti?

### Ledger
Segmen N → DONE (sudah update tabel §2 + commit)

### Next
Segmen N+1: [judul]
```

Setelah SEMUA 10 segmen DONE → kirim ringkasan akhir + daftar semua commit. Fable akan audit total (cross-check origin/main independen, smoke test live). JANGAN klaim "FULL DONE" tanpa 10 baris ledger = DONE + 10 SONNET REPORT.

---

## 12. DEFINITION OF DONE (keseluruhan)

- 10 segmen DONE di ledger, tiap segmen ada SONNET REPORT dengan commit asli.
- `npx tsc --noEmit` 0 error baru; `npm run build` sukses.
- Migration additive ter-apply; `prisma generate` clean.
- `/ads?tab=testing` (atau `/testing`) kebuka; bisa bikin test → sync → declare winner.
- Tidak ada `workerTask.create` baru; Hermes API tidak berubah perilaku.
- CPAS tidak tampil di nav; model CPAS masih ada (tidak dihapus).
- Tidak ada kredensial di code/log/commit; tidak ada reset password prod.
```
