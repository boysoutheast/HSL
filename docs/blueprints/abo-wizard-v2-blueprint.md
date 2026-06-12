# Blueprint v2: Wizard Re-arsitektur — Campaign → Ad Sets → Ads

**Author:** Fable 5 · **Executor:** Sonnet · **Auditor:** Fable 5
**Tanggal:** 2026-06-12 · **Basis:** `abo-research-results.md` (R1–R15, audited PASS) + feedback owner
**Menggantikan:** layout wizard dari `abo-cbo-blueprint.md` (schema & payload v1-nya tetap dipakai sebagai fondasi)

---

## 0. Kenapa v2

Wizard sekarang salah penataan: audience/placement ditanya campaign-level, Page+IG ditanya di awal. Struktur Meta asli (confirmed riset R15):

| Layer | Pegang apa |
|---|---|
| **Campaign** | objective, budget mode (CBO/ABO), budget+bid (CBO only), special ad categories, budget-sharing toggle |
| **Ad Set** | destination, optimization goal, pixel/dataset, budget+schedule (ABO), audience LENGKAP (geo/CA/age/gender/detailed targeting), placements, devices |
| **Ad** | identity Page+IG, format creative, media, copy, URL, url_tags |

Prinsip sama dengan v1: **additive schema, zero breaking change**, build hijau per fase, verifikasi produksi sebelum DONE.

## 0b. Keputusan desain dari gap riset (NOT_FOUND) — FINAL, jangan didebat ulang saat eksekusi

| Gap | Keputusan v2 |
|---|---|
| Attribution enum/default (R4) | **Jangan expose UI attribution. Jangan kirim `attribution_spec`** — biarkan server default Meta. Tooltip "bahasa bayi" tetap ditampilkan sebagai info statis. |
| Placement enum lengkap (R10) | Pakai curated token list (§6) → mapping `publisher_platforms` + `*_positions`. Posisi bertanda ⚠️inferred WAJIB di-flag di kode (komentar) untuk live write/readback validation saat worker write-mode nyala. Default UI: **automatic** (omit semua placement fields). |
| OS version syntax (R9) | **Skip filter versi OS.** Devices hanya `device_platforms`: all / mobile / desktop (enum verified). |
| Minimum budget IDR (R14) | Tidak ada validasi angka minimum lokal — hanya `> 0`. Error Meta di-surface apa adanya ke UI. |
| Budget sharing default (R1) | Saat ABO: **selalu kirim eksplisit** `is_adset_budget_sharing_enabled: false` di campaign payload. |
| `targetingsearch` endpoint (R8) | Pakai `GET /search?type=adinterest&q=...` (inferred). Implementasi WAJIB graceful: kalau Meta balas error, UI tampilkan "search interest tidak tersedia" — bukan crash. |
| Dayparting (R6) | Out of scope. Schedule hanya `start_time`/`end_time`. |

---

## 1. Macro Framework Baru (urutan step wizard)

```
STEP 1  Campaign      → nama, Meta connection, ad account, objective,
                        budget mode (CBO|ABO), [CBO: budget + bid strategy]
STEP 2  Ad Sets       → repeatable cards; per adset SEMUA targeting & budget
STEP 3  Ads           → per adset: identity + creatives
STEP 4  Review        → tree campaign → adsets → ads, submit
```

4 step (dari 6). Yang hilang dari step lama: "Page & Instagram" (pindah ke Step 3 per-adset), "Placement"/"Audience"/"Pixel" (pindah ke Step 2 per-adset).

### Step 1 — Campaign
- Nama campaign (existing)
- Meta Connection + Ad Account (existing, dengan fetch bid capabilities existing)
- Objective: Leads | Sales | Traffic (existing)
- **Budget Mode toggle** (existing v1): CBO → Daily Budget + Bid Strategy campaign-level tampil; ABO → keduanya hidden, hint "diatur per ad set"
- TIDAK ADA: destination URL, page, audience, placement, pixel

### Step 2 — Ad Sets (inti perubahan)
Repeatable cards (min 1; CBO juga boleh >1 adset — budget-nya saja yang di campaign). Per card:

| Urutan | Field | Sumber/perilaku |
|---|---|---|
| 1 | Nama adset | text, default `{campaign} - Adset {n}` |
| 2 | Conversion location | **locked "Website"** (`destination_type: WEBSITE` hardcode v2; UI read-only label + tooltip) |
| 3 | Pixel + Event | dropdown dinamis dari endpoint baru `/api/admin/meta-tools/adspixels` (§5); event = select `custom_event_type` (PURCHASE/LEAD/ADD_TO_CART/COMPLETE_REGISTRATION/INITIATED_CHECKOUT/CONTACT — subset umum dari enum verified R5). Wajib saat objective SALES; wajib saat LEADS+website |
| 4 | Budget (ABO only) | number > 0; CBO: hidden |
| 5 | Bid strategy (ABO only) | radio dari capabilities fetch existing (per ad account); + amount kalau COST_CAP/BID_CAP/MIN_ROAS. CBO: hidden (pakai campaign-level) |
| 6 | Schedule | radio: "Mulai sekarang" (omit start_time) / "Jadwalkan" (datetime picker → `start_time` ISO8601); `end_time` optional |
| 7 | Location | fitur existing: Indonesia / Use AI (geoMode + resolve-locations) — per adset |
| 8 | Custom audiences | include + **exclude** (baru: `excluded_custom_audiences`) — multi-select dari fetch existing |
| 9 | Age | range existing (per adset) |
| 10 | Gender | existing (per adset) |
| 11 | Detailed targeting | autocomplete interest via endpoint baru `/api/admin/meta-tools/interest-search` (§5) → chips; satu blok `flexible_spec[0].interests` saja di v2 (AND antar blok = out of scope). Graceful kalau search down |
| 12 | Devices | radio: Semua / Mobile saja / Desktop saja → `device_platforms` |
| 13 | Placements | radio Automatic (default, omit fields) / Manual → checkbox curated tokens (§6) |

UX: card collapsed nampilin ringkasan (`nama · budget · lokasi · N creatives`). Tombol **"Duplicate ad set"** — copy semua field card (workflow ABO paling umum: clone adset, ganti audience).

### Step 3 — Ads (per adset)
Tab/accordion per adset (sinkron dengan Step 2). Per adset:

1. **Identity**: FB Page + IG account (komponen existing dipindah ke sini) — disimpan per adset, worker apply ke semua ads adset itu (`object_story_spec.page_id` + `instagram_user_id` — R11: `instagram_user_id`, BUKAN `instagram_actor_id`)
2. **Creatives** (repeatable per adset, min 1):
   - Format: **Single Image/Video** | **Carousel** (§fase F6, boleh nyusul)
   - Media: picker dari Media Library existing / manual URL
   - Website URL (per creative → `link_data.link`) — wajib
   - Primary text ≤125 + counter (existing)
   - Headline ≤255 + counter (existing)
   - Description (baru, optional → `link_data.description`)
   - CTA (existing)
   - URL tags (optional, string `utm_source=...` → `url_tags` di creative)
   - Carousel: 2–10 cards, per card {media, headline, link} (`child_attachments`)
3. Tombol **"Copy creatives dari adset lain"** — duplikasi cepat antar adset

### Step 4 — Review
Tree view: campaign → tiap adset (budget, lokasi ringkas, jumlah ads) → submit. Semua error validasi (§7) muncul di sini juga inline.

---

## 2. Schema Delta (additive, dari v1 yang sudah shipped)

```prisma
model TestLaunchAdset {
  // ...existing v1 fields (name, dailyBudget, bidStrategyJson, audienceJson, sortOrder, status)...
  destinationType  String    @default("WEBSITE") @map("destination_type")
  optimizationGoal String?   @map("optimization_goal")  // derived server-side (§4 matriks)
  billingEvent     String?   @map("billing_event")      // derived server-side
  pixelId          String?   @map("pixel_id")
  customEventType  String?   @map("custom_event_type")
  startTime        DateTime? @map("start_time")
  endTime          DateTime? @map("end_time")
  placementMode    String    @default("automatic") @map("placement_mode")
  placementsJson   String?   @map("placements_json")    // token list UI
  targetingJson    String?   @map("targeting_json")     // {interests:[], excludedCustomAudienceIds:[], devicePlatforms:[]}
  identityPageId   String?   @map("identity_page_id")
  identityIgUserId String?   @map("identity_ig_user_id")
}

model TestLaunchCreative {
  // ...existing...
  format               String  @default("single") @map("format") // single | carousel
  linkUrl              String? @map("link_url")
  description          String? @map("description")
  urlTags              String? @map("url_tags")
  childAttachmentsJson String? @map("child_attachments_json") // carousel cards
  videoId              String? @map("video_id")
}
```

⚠️ **ATURAN MIGRATION (tidak berubah dari v1, pernah jadi insiden):** semua `ADD COLUMN IF NOT EXISTS`, no `cuid()`, no `randomblob`, **SEMUA field camelCase WAJIB `@map`**, setelah edit schema → `npx prisma generate` → `npm run build` sebelum commit. Satu file migration: `20260612200000_wizard_v2_adset_fields`.

---

## 3. API Changes

### `POST /api/admin/test-launches` — shape v2
```jsonc
{
  "budgetMode": "ABO",            // atau CBO
  "name": "...", "objective": "OUTCOME_SALES",
  "metaAccountId": "...", "metaAdAccountId": "...",
  "dailyBudget": 100000,           // CBO only; ABO → 400 kalau terisi (rule existing)
  "bidStrategy": {...},            // CBO only
  "adsets": [
    {
      "name": "...", "dailyBudget": 50000, "bidStrategy": {...},   // ABO
      "pixelId": "...", "customEventType": "PURCHASE",
      "startTime": null, "endTime": null,
      "audienceJson": "{...}",                                      // geo+age+gender+CA include (existing shape)
      "targetingJson": "{\"interests\":[],\"excludedCustomAudienceIds\":[],\"devicePlatforms\":[]}",
      "placementMode": "automatic", "placements": [],
      "identityPageId": "...", "identityIgUserId": "...",
      "creatives": [
        { "format": "single", "creativeUrl": "...", "linkUrl": "https://...",
          "primaryText": "...", "headline": "...", "description": "...",
          "callToAction": "SHOP_NOW", "urlTags": "utm_source=fb", "sortOrder": 0 }
      ]
    }
  ]
}
```
Backward compat: shape v1 (flat `creatives[]`, CBO tanpa `adsets`) **TETAP diterima** → server auto-wrap jadi 1 adset internal. Jangan hapus path lama.

### Endpoint BARU
1. **`GET /api/admin/meta-tools/adspixels?adAccountId=<internal id>`**
   Ownership check pattern sama dengan adaccount-capabilities. `graphFetch('act_{id}/adspixels', token, {params:{fields:'id,name'}})`. Return `{ pixels: [{id,name}] }`. **Hapus hardcode `PIXEL_OPTIONS`** dari wizard — ganti fetch ini (refresh saat ad account dipilih, pattern sama bid capabilities).
2. **`GET /api/admin/meta-tools/interest-search?q=<query>&metaAccountId=<id>`**
   Proxy `graphFetch('search', token, {params:{type:'adinterest', q, limit:'25'}})`. Return `{ interests: [{id,name,audience_size_lower_bound?}] }`. Kalau Meta error → 502 dengan `{error}` jelas; UI graceful.

### Approval payload v3 (`approval-requests/[id]/route.ts`)
```jsonc
{
  "payloadVersion": 3,
  "budgetMode": "ABO",
  "campaign": {
    "name": "...", "objective": "...",
    "specialAdCategories": [],                       // WAJIB kirim (R14: required true)
    "dailyBudget": 100000, "bidStrategy": {...},     // CBO only
    "isAdsetBudgetSharingEnabled": false             // ABO only, eksplisit (R1)
  },
  "adsets": [{
    "name": "...", "dailyBudget": 50000, "bidStrategy": {...},
    "destinationType": "WEBSITE",
    "optimizationGoal": "OFFSITE_CONVERSIONS", "billingEvent": "IMPRESSIONS",  // dari matriks §4
    "promotedObject": { "pixelId": "...", "customEventType": "PURCHASE" },
    "startTime": null, "endTime": null,
    "targeting": {
      "geoLocations": {...}, "ageMin": 25, "ageMax": 45, "genders": "all",
      "customAudiences": [{"id":"..."}], "excludedCustomAudiences": [{"id":"..."}],
      "flexibleSpec": [{"interests":[{"id":"...","name":"..."}]}],
      "devicePlatforms": ["mobile"],
      "placements": { "mode": "manual", "publisherPlatforms": ["instagram"], "instagramPositions": ["stream","story"] }
    },
    "ads": [{
      "identity": { "pageId": "...", "instagramUserId": "..." },
      "creative": { "format": "single", "linkUrl": "...", "message": "...", "headline": "...",
                    "description": "...", "cta": "SHOP_NOW", "mediaUrl": "...",
                    "children": null },
      "urlTags": "utm_source=fb"
    }]
  }],
  "adAccountId": "...", "metaConnectionId": "...", "snapshotAt": "..."
}
```
**taskType:** semua launch dari wizard v2 (CBO maupun ABO) → **`create_full_launch_v3`** (baru). Worker sekarang dry-run, jadi aman; taskType lama tetap di-handle untuk draft lama yang belum di-approve. Mapping placement token → API fields dilakukan **server-side saat build payload** (§6), bukan di worker.

---

## 4. Matriks objective → optimization_goal + billing_event (server-side derive)

Dari R2 (confidence inferred, konservatif — hanya WEBSITE destination):

| Objective | optimization_goal | billing_event | promoted_object |
|---|---|---|---|
| OUTCOME_SALES | `OFFSITE_CONVERSIONS` | `IMPRESSIONS` | WAJIB pixel + event |
| OUTCOME_LEADS | `OFFSITE_CONVERSIONS` | `IMPRESSIONS` | WAJIB pixel + event (default LEAD) |
| OUTCOME_TRAFFIC | `LANDING_PAGE_VIEWS` | `IMPRESSIONS` | pixel optional |

Hardcode tabel ini di satu modul `src/lib/meta-objective-matrix.ts` (single source of truth, dipakai validasi POST + payload builder). Komentar di file: confidence inferred, validasi final oleh Meta saat live launch.

---

## 5. Placement tokens v2 (curated; perbaiki regression 19→6)

| Token UI | publisher_platforms | positions field | value | Confidence |
|---|---|---|---|---|
| facebook_feed | facebook | facebook_positions | `feed` | ⚠️inferred |
| facebook_stories | facebook | facebook_positions | `story` | ⚠️inferred |
| facebook_reels | facebook | facebook_positions | `facebook_reels` | ⚠️inferred |
| facebook_video_feeds | facebook | facebook_positions | `video_feeds` | ⚠️inferred |
| facebook_marketplace | facebook | facebook_positions | `marketplace` | ⚠️inferred |
| facebook_search | facebook | facebook_positions | `search` | ⚠️inferred |
| instagram_feed | instagram | instagram_positions | `stream` | ⚠️inferred |
| instagram_stories | instagram | instagram_positions | `story` | ⚠️inferred |
| instagram_reels | instagram | instagram_positions | `reels` | ⚠️inferred |
| instagram_explore | instagram | instagram_positions | `explore` | ⚠️inferred |
| instagram_profile_feed | instagram | instagram_positions | `profile_feed` | ⚠️inferred |
| messenger_inbox | messenger | messenger_positions | `messenger_home` | ⚠️inferred |
| messenger_stories | messenger | messenger_positions | `story` | ⚠️inferred |
| audience_network_native | audience_network | audience_network_positions | `classic` | ⚠️inferred |
| audience_network_rewarded | audience_network | audience_network_positions | `rewarded_video` | ⚠️inferred |

Mapping table ini ditaruh di `src/lib/meta-placement-map.ts` dengan komentar: SEMUA position values inferred (R10 NOT_FOUND enum resmi) — wajib live write/readback validation saat worker write-mode pertama kali nyala. UI default tetap Automatic.

---

## 6. Validation Matrix (POST, semua 400 + pesan jelas)

| Kondisi | Rule |
|---|---|
| ABO | tiap adset `dailyBudget > 0`; campaign dailyBudget absen |
| CBO | campaign `dailyBudget > 0`; adset dailyBudget absen/null |
| objective SALES | tiap adset `pixelId` + `customEventType` wajib |
| objective LEADS | tiap adset `pixelId` wajib (event default LEAD) |
| tiap adset | min 1 creative |
| tiap creative | `linkUrl` wajib (valid URL), primaryText ≤125, headline ≤255 |
| identity | tiap adset `identityPageId` wajib |
| carousel | 2 ≤ cards ≤ 10; per card media + link wajib |
| schedule | `endTime` > `startTime` kalau dua-duanya terisi |
| placement manual | min 1 token |

---

## 7. Urutan Eksekusi Sonnet

**ATURAN BARU (dari insiden v1 — dua kali nyimpang tanpa flag):**
> Kalau saat eksekusi lo merasa perlu MENYIMPANG dari blueprint ini (field beda, fix tambahan, potong scope), **STOP — tulis penyimpangan + alasan di commit message dengan prefix `DEVIATION:`** dan laporkan di ringkasan akhir. Jangan silent. Insiden v1: status `'PENDING'` uppercase (bikin pipeline mati) dan placement 19→6 dipotong diam-diam.

| Fase | Isi | Verify |
|---|---|---|
| F1 | Schema delta + migration + generate | build hijau |
| F2 | Modul `meta-objective-matrix.ts` + `meta-placement-map.ts` + endpoint adspixels + interest-search | build + curl kedua endpoint di prod (setelah deploy F1-F4 boleh digabung) |
| F3 | POST/GET test-launches v2 (nested penuh + backward compat v1 auto-wrap) | build |
| F4 | Approval payload v3 + taskType `create_full_launch_v3` | build |
| F5 | Wizard UI 4-step | build, push semua |
| F6 (boleh nyusul) | Carousel format di Step 3 + validasi | build |
| F7 | Acceptance produksi (§8) | semua pass → DONE |

Login produksi: SEKALI, reuse cookie (rate limit). Deploy: cek log `prisma migrate deploy` sukses (insiden P3009 pernah terjadi).

---

## 8. Acceptance Tests (produksi)

1. POST shape v1 lama (flat CBO) → 201, server auto-wrap 1 adset — **regresi guard**
2. POST v2 ABO 2 adsets beda audience+identity, 2 creatives each → 201, GET nested utuh
3. POST ABO tanpa pixel saat SALES → 400
4. POST creative tanpa linkUrl → 400
5. `GET adspixels` ad account valid → list pixel beneran dari Meta (bandingkan dengan yang dulu hardcoded)
6. `GET interest-search?q=skincare` → interests array ATAU 502 graceful (dua-duanya acceptable, catat hasilnya)
7. Approve ABO → task `create_full_launch_v3`, status **`pending` lowercase**, payload: campaign ada `specialAdCategories` + `isAdsetBudgetSharingEnabled:false`, adset ada `optimizationGoal`+`billingEvent`+`promotedObject`, ads punya `identity.instagramUserId`, placement manual ter-map ke `publisherPlatforms`+positions
8. Approve CBO v2 → task `create_full_launch_v3`, campaign ada dailyBudget, adsets TANPA dailyBudget
9. Task ke-claim worker (status berubah dari pending dalam ≤60s; worker dry-run akan completed) — **claimability check, jangan skip** (insiden v1)
10. Cleanup semua row test (psql/API), readback 0 sisa

---

## 9. Rollback & Out of Scope

Rollback: per fase `git revert`; migration additive dibiarkan (jangan drop di prod).

Out of scope v2 (JANGAN dikerjain): attribution UI, OS version filter, dayparting, multiple flexible_spec blocks (AND targeting), video upload langsung ke Meta (`advideos` — media tetap via URL/library), destination selain WEBSITE, edit adset pasca-create, `asyncadrequestsets`, implementasi worker eksternal (repo lain; butuh handler `create_full_launch_v3` + write mode — catat untuk owner).
