# HSL — Blueprint MVP v1
**Hermes Support Library · Self-serve SaaS + AI Worker Platform**
Last updated: 2026-06-11

---

## 1. Visi Produk

HSL adalah **SaaS platform untuk automated social media content factory** berbasis Instagram.

- **Client** daftar sendiri, setup akun IG, isi media library, set rules → sistem jalan sendiri
- **Hermes Workers** adalah AI executor yang ambil task dari HSL, generate konten (video/foto/caption), dan post ke Instagram
- **Core loop**: Library → Worker generate → Post → Monitor performa → Decide kapan post lagi → Repeat
- **Monetisasi**: Self-serve per akun IG yang dikelola (SaaS subscription)

Referensi benchmark: [bir.ch](https://bir.ch) — social media content automation platform

---

## 2. Status Saat Ini (Audit Juni 2026)

### ✅ Sudah Ada & Production-Ready
| Komponen | Detail |
|---|---|
| Multi-user SaaS foundation | Role-based (admin/user), DB session 8 jam, ownership isolation |
| Instagram Account management | CRUD, status tracking, last post tracking |
| Character/Persona | Behavior, speaking style, movement style, forbidden rules |
| Topic management | Link ke karakter atau produk |
| Product management | Nama, deskripsi, harga, Shopee URL |
| Photo library | Upload, serve, lightbox, Railway Volume storage |
| CEP (Core Emotional Proposition) | Human + AI source, status workflow |
| Content log | Track semua generated/posted content |
| Posting Monitor rules engine | Status: WAITING → MONITORING → READY_UPLOAD ↔ LOCKED_HOT |
| Hermes Worker API | Bearer token auth, library endpoint, ready-upload polling |
| Cron jobs | posting-monitor, fetch-metrics, cleanup-locks |
| Hard delete + cascade | Semua entity + file cleanup |
| Photo lightbox + download | UI fullscreen view |
| Deployment | Railway + PostgreSQL + Volume, Docker, health check |

### ❌ Gap yang Harus Dibangun (MVP)
| Gap | Priority |
|---|---|
| Video support di media library | P0 |
| Landing Page per produk | P0 |
| WorkerTask queue (ganti pure polling) | P0 |
| Media auto top-up rules | P1 |
| Meta Ads integration (Advantage+ API) | P1 |
| Meta CAPI proxy | P2 |
| ABO→CBO creative test orchestrator | P2 |
| CPAS / Shopee catalog | P3 |
| Billing / tenant isolation | P3 |

---

## 3. Arsitektur MVP

```
┌─────────────────────────────────────────────────────┐
│                    CLIENT BROWSER                    │
│              (Admin Dashboard — Next.js)             │
└─────────────────────┬───────────────────────────────┘
                      │ HTTPS
┌─────────────────────▼───────────────────────────────┐
│                 HSL SERVER (Railway)                 │
│                                                      │
│  ┌─────────────┐  ┌────────────────┐  ┌──────────┐ │
│  │ Admin API   │  │  Hermes API    │  │ Cron API │ │
│  │ /api/admin/ │  │ /api/hermes/   │  │/api/cron/│ │
│  │ session auth│  │ Bearer token   │  │ secret   │ │
│  └──────┬──────┘  └───────┬────────┘  └────┬─────┘ │
│         │                 │                 │        │
│  ┌──────▼─────────────────▼─────────────────▼─────┐ │
│  │              PostgreSQL (Prisma ORM)            │ │
│  │  14 existing models + 6 new MVP models          │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │          Railway Volume /data/media              │ │
│  │          (photo + video files)                  │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ Hermes   │  │ Hermes   │  │ Hermes   │
  │ Worker A │  │ Worker B │  │ Worker C │
  │(video gen)│  │(photo gen)│  │(posting) │
  └──────────┘  └──────────┘  └──────────┘
```

---

## 4. Database Schema — 6 Model Baru MVP

### 4.1 MediaAsset (upgrade dari PhotoReference)

```prisma
model MediaAsset {
  id              String   @id @default(cuid())
  type            String   // 'photo' | 'video' | 'carousel_frame'
  fileUrl         String   @map("file_url")
  thumbnailUrl    String?  @map("thumbnail_url")
  
  // Dimensi & durasi
  width           Int?
  height          Int?
  duration        Float?   // detik (video only)
  aspectRatio     String?  @map("aspect_ratio") // '9:16' | '1:1' | '16:9'
  fileSizeBytes   Int?     @map("file_size_bytes")
  mimeType        String?  @map("mime_type")
  
  // Konteks
  label           String?
  category        String?  // 'ugc' | 'product_demo' | 'testimonial' | 'lifestyle' | 'raw'
  tags            String[] // array tag bebas
  notes           String?
  status          String   @default("active") // 'active' | 'archived'
  
  // Ownership & relasi
  createdByUserId    String?  @map("created_by_user_id")
  createdByWorkerId  String?  @map("created_by_worker_id")
  instagramAccountId String?  @map("instagram_account_id")
  characterId        String?  @map("character_id")
  productId          String?  @map("product_id")
  topicId            String?  @map("topic_id")
  
  // Performance tracking
  usedInAdCount   Int      @default(0) @map("used_in_ad_count")
  performanceScore Float?  @map("performance_score") // 0-100, dari A/B test
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  
  // Relations
  instagramAccount InstagramAccount? @relation(fields: [instagramAccountId], references: [id])
  character        Character?        @relation(fields: [characterId], references: [id])
  product          Product?          @relation(fields: [productId], references: [id])
  topic            Topic?            @relation(fields: [topicId], references: [id])
  createdByWorker  HermesAgent?      @relation(fields: [createdByWorkerId], references: [id])
  workerTaskResults WorkerTaskResult[]
  
  @@index([type])
  @@index([characterId])
  @@index([productId])
  @@index([createdByUserId])
  @@map("media_assets")
}
```

### 4.2 LandingPage

```prisma
model LandingPage {
  id          String   @id @default(cuid())
  productId   String   @map("product_id")
  
  url         String
  variant     String   @default("A") // 'A' | 'B' | 'control' | custom label
  type        String   @default("shopee") // 'shopee' | 'custom' | 'whatsapp' | 'linktree'
  label       String?  // nama deskriptif, misal "LP Shopee Basic" vs "LP Custom Video"
  isActive    Boolean  @default(true) @map("is_active")
  isDefault   Boolean  @default(false) @map("is_default") // LP default untuk produk ini
  notes       String?
  
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  
  product           Product              @relation(fields: [productId], references: [id], onDelete: Cascade)
  performanceStats  LandingPageStat[]
  
  @@index([productId])
  @@map("landing_pages")
}
```

### 4.3 LandingPageStat

```prisma
model LandingPageStat {
  id              String   @id @default(cuid())
  landingPageId   String   @map("landing_page_id")
  
  // Source of traffic
  source          String?  // 'organic' | 'meta_ad' | 'hermes_post'
  sourceRefId     String?  @map("source_ref_id") // contentLogId atau campaignId
  
  // Metrics (diupdate manual atau via CAPI)
  clicks          Int      @default(0)
  conversions     Int      @default(0)
  revenue         Float    @default(0)
  
  // Computed
  conversionRate  Float?   @map("conversion_rate") // conversions / clicks * 100
  
  date            DateTime @default(now()) // grouping per hari
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  
  landingPage     LandingPage @relation(fields: [landingPageId], references: [id], onDelete: Cascade)
  
  @@index([landingPageId])
  @@index([date])
  @@map("landing_page_stats")
}
```

### 4.4 WorkerTask

```prisma
model WorkerTask {
  id            String   @id @default(cuid())
  workerId      String?  @map("worker_id") // null = belum di-assign
  
  type          String
  // 'GENERATE_VIDEO' | 'GENERATE_PHOTO' | 'POST_CONTENT'
  // 'REFRESH_CREATIVE' | 'CAPTION_ONLY' | 'CEP_GENERATION'
  
  priority      Int      @default(3) // 1 = urgent, 5 = low
  status        String   @default("PENDING")
  // 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'DONE' | 'FAILED' | 'CANCELLED'
  
  // Brief untuk worker
  payload       Json
  // {
  //   instagramAccountId, characterId, topicId, productId,
  //   cepId, mediaAssetIds[], landingPageId,
  //   brief: string, requirements: string,
  //   targetAspectRatio: '9:16' | '1:1',
  //   targetDurationSeconds: number,
  // }
  
  // Timing
  scheduledFor  DateTime? @map("scheduled_for") // null = ambil sekarang
  assignedAt    DateTime? @map("assigned_at")
  startedAt     DateTime? @map("started_at")
  completedAt   DateTime? @map("completed_at")
  timeoutAt     DateTime? @map("timeout_at")
  
  // Error tracking
  errorMessage  String?   @map("error_message")
  retryCount    Int       @default(0) @map("retry_count")
  maxRetries    Int       @default(3) @map("max_retries")
  
  // Context linkage
  instagramAccountId String?  @map("instagram_account_id")
  characterId        String?  @map("character_id")
  productId          String?  @map("product_id")
  
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  
  worker        HermesAgent? @relation(fields: [workerId], references: [id])
  results       WorkerTaskResult[]
  
  @@index([status, priority])
  @@index([workerId])
  @@index([scheduledFor])
  @@map("worker_tasks")
}
```

### 4.5 WorkerTaskResult

```prisma
model WorkerTaskResult {
  id            String   @id @default(cuid())
  taskId        String   @map("task_id")
  
  // Output dari worker
  mediaAssetId  String?  @map("media_asset_id") // asset yang dihasilkan
  contentLogId  String?  @map("content_log_id") // jika langsung post
  
  outputType    String   // 'media_asset' | 'content_log' | 'cep'
  outputData    Json?    // extra data dari worker
  
  notes         String?
  createdAt     DateTime @default(now()) @map("created_at")
  
  task          WorkerTask   @relation(fields: [taskId], references: [id], onDelete: Cascade)
  mediaAsset    MediaAsset?  @relation(fields: [mediaAssetId], references: [id])
  
  @@index([taskId])
  @@map("worker_task_results")
}
```

### 4.6 MediaLibraryRule

```prisma
model MediaLibraryRule {
  id          String   @id @default(cuid())
  name        String
  isActive    Boolean  @default(true) @map("is_active")
  
  // Trigger: scope
  scope       String   // 'character' | 'product' | 'account' | 'global'
  scopeId     String?  @map("scope_id") // characterId / productId / accountId
  
  // Trigger: kondisi
  mediaType   String   // 'photo' | 'video' | 'any'
  category    String?  // filter by category, null = semua
  
  triggerType String   @map("trigger_type")
  // 'BELOW_COUNT'    → jika jumlah asset < threshold → trigger
  // 'OLDER_THAN_DAYS'→ jika asset terbaru > X hari → trigger
  // 'NO_WINNER'      → jika tidak ada asset dengan performanceScore > X → trigger
  
  threshold   Float    // value untuk triggerType (jumlah / hari / score)
  
  // Action
  actionType  String   @map("action_type")
  // 'CREATE_WORKER_TASK' → buat WorkerTask otomatis
  // 'NOTIFY_ADMIN'       → flag di dashboard
  
  taskType    String?  @map("task_type") // type WorkerTask yang dibuat
  taskPayload Json?    @map("task_payload") // payload template
  taskPriority Int     @default(3) @map("task_priority")
  
  // Tracking
  lastTriggeredAt DateTime? @map("last_triggered_at")
  triggerCount    Int       @default(0) @map("trigger_count")
  
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  
  @@index([isActive])
  @@index([scope, scopeId])
  @@map("media_library_rules")
}
```

---

## 5. API Endpoints — Tambahan MVP

### Media Assets
```
GET    /api/admin/media                          List assets (filter: type, category, characterId, productId)
POST   /api/admin/media/upload                   Upload photo atau video (multipart)
PATCH  /api/admin/media/[id]                     Update label, category, tags, notes
DELETE /api/admin/media/[id]                     Hard delete + file cleanup
GET    /api/admin/media/[id]                     Get detail asset

GET    /api/media/serve/[...key]                 Serve file (photo/video) + cache header
```

### Landing Pages
```
GET    /api/admin/products/[id]/landing-pages    List LP untuk produk
POST   /api/admin/products/[id]/landing-pages    Tambah LP variant baru
PATCH  /api/admin/landing-pages/[id]             Update LP (url, label, isActive, isDefault)
DELETE /api/admin/landing-pages/[id]             Hapus LP
POST   /api/admin/landing-pages/[id]/stats       Record klik/konversi manual
GET    /api/admin/landing-pages/[id]/stats       Lihat performa LP
```

### Worker Task Queue
```
GET    /api/admin/worker-tasks                   List semua tasks (filter: status, workerId, type)
POST   /api/admin/worker-tasks                   Buat task manual dari admin
PATCH  /api/admin/worker-tasks/[id]              Cancel / update task
GET    /api/admin/worker-tasks/[id]              Detail task + results

# Worker-facing (Bearer token)
GET    /api/hermes/tasks                         Ambil task yang di-assign ke worker ini
POST   /api/hermes/tasks/[id]/claim              Worker claim task (PENDING → ASSIGNED)
POST   /api/hermes/tasks/[id]/start              Worker mulai (ASSIGNED → IN_PROGRESS)
POST   /api/hermes/tasks/[id]/complete           Worker selesai + upload hasil
POST   /api/hermes/tasks/[id]/fail               Worker report error

# Worker capability registration
POST   /api/hermes/capabilities                  Worker daftarkan capabilities
# payload: { capabilities: ['video_gen', 'photo_gen', 'posting', 'caption'] }
```

### Media Library Rules
```
GET    /api/admin/media-rules                    List semua rules
POST   /api/admin/media-rules                    Buat rule baru
PATCH  /api/admin/media-rules/[id]               Update / pause rule
DELETE /api/admin/media-rules/[id]               Hapus rule
POST   /api/cron/media-rules                     Evaluasi semua rules (cron hourly)
```

### Hermes Library Update
```
# Extend GET /api/hermes/library untuk include:
# - mediaAssets (video + photo) dengan filter type/category
# - landingPages per produk (LP default + variants)
# - pendingTasks yang di-assign ke worker ini
```

---

## 6. Dashboard Pages — Tambahan MVP

| Path | Fungsi |
|---|---|
| `/media` | Media library baru — grid view photo + video, filter by type/category/character/product, upload, tag, delete |
| `/media/[id]` | Detail asset — preview (video player / lightbox), performance score, di-assign ke mana, dipakai di berapa content |
| `/products/[id]` (upgrade) | Tambah tab "Landing Pages" — CRUD LP variants, lihat performa per variant |
| `/workers` | Worker overview — status, capabilities, task queue, berapa task pending/done/failed |
| `/workers/tasks` | Task queue — semua task dengan status, priority, timeline, hasil |
| `/media-rules` | Library rules — create/edit/pause rules, lihat last triggered |

---

## 7. Worker Task Flow (Baru)

```
SEKARANG (polling):
Worker → GET /api/hermes/ready-upload → HSL return account → Worker kerja

MVP (task queue):
HSL → CREATE WorkerTask (dari rule / admin / cron)
     ↓
Worker → GET /api/hermes/tasks → ambil task yang cocok dengan capabilities
     ↓
Worker → POST /api/hermes/tasks/[id]/claim → status: ASSIGNED
     ↓
Worker → POST /api/hermes/tasks/[id]/start → status: IN_PROGRESS
     ↓
Worker generate content (video/photo/caption)
     ↓
Worker upload via POST /api/admin/media/upload → dapat mediaAssetId
     ↓
Worker → POST /api/hermes/tasks/[id]/complete
          payload: { mediaAssetId, contentLogId, notes }
          → status: DONE
     ↓
HSL auto-trigger posting monitor jika type = POST_CONTENT
```

**Worker Capabilities Registry:**
```json
{
  "capabilities": ["video_gen", "photo_gen", "posting", "caption", "cep_gen"],
  "maxConcurrentTasks": 3,
  "avgTaskDurationSeconds": { "video_gen": 120, "photo_gen": 30, "posting": 10 }
}
```

HSL route task ke worker berdasarkan:
1. Capability match
2. Worker status (tidak overload)
3. Priority task

---

## 8. Produk + Landing Page — Alur Testing

```
Produk: "Serum Vitamin C 10%"
├── Landing Page A (default): https://shopee.co.id/serum-vit-c → type: shopee
├── Landing Page B: https://brand.com/serum-lp → type: custom (ada video testimonial)
└── Landing Page C: https://wa.me/628xxx → type: whatsapp

Worker task GENERATE_VIDEO:
  payload: {
    productId: "xxx",
    landingPageId: "LP-B", ← Worker tahu LP mana yang dipakai
    cepId: "yyy",          ← CEP yang akan divisualisasikan
    brief: "Demo serum di kulit, closeup texture, CTA ke LP custom"
  }

Hermes post dengan caption yang menyebut LP
→ Performance tracker monitor views
→ LandingPageStat record klik dari bio/swipe-up
→ Dashboard compare: LP A vs LP B conversion rate
→ Recommend LP terbaik untuk campaign berikutnya
```

---

## 9. Media Library Rules — Contoh

```
Rule 1: "Karakter Siti — Video Refresh"
  scope: character | scopeId: char_siti
  mediaType: video
  triggerType: OLDER_THAN_DAYS | threshold: 30
  → Jika video Siti yang terbaru > 30 hari:
    CREATE WorkerTask type=GENERATE_VIDEO priority=2
    payload: { characterId: char_siti, brief: "Fresh lifestyle content" }

Rule 2: "Produk X — Minimum Stock"
  scope: product | scopeId: prod_x
  mediaType: photo
  category: product_demo
  triggerType: BELOW_COUNT | threshold: 5
  → Jika foto product_demo Produk X < 5:
    CREATE WorkerTask type=GENERATE_PHOTO priority=3

Rule 3: "Global — No Winner Alert"
  scope: global
  mediaType: video
  triggerType: NO_WINNER | threshold: 60 ← performanceScore
  → Jika tidak ada video dengan score > 60 dalam 14 hari:
    actionType: NOTIFY_ADMIN (flag di dashboard)
```

---

## 10. Hermes Worker API — Contract Baru

```typescript
// GET /api/hermes/tasks
// Worker ambil task yang available sesuai capabilities
Response: {
  tasks: [
    {
      id: string,
      type: 'GENERATE_VIDEO' | 'GENERATE_PHOTO' | 'POST_CONTENT' | ...,
      priority: 1-5,
      payload: {
        // Brief lengkap
        instagramAccountId: string,
        characterId?: string,
        character?: {
          name, behavior, speakingStyle, expressionStyle, movementStyle, forbiddenRules
        },
        topicId?: string,
        topic?: { name, description },
        productId?: string,
        product?: { name, description, mainBenefit, shopeeUrl },
        landingPageId?: string,
        landingPage?: { url, type, variant },
        cepId?: string,
        cep?: { cepText, painPoint, angle },
        referenceAssets: [{ id, type, fileUrl, label, category }],
        brief: string,
        requirements: string,
        targetAspectRatio: '9:16' | '1:1' | '16:9',
        targetDurationSeconds?: number,
      },
      scheduledFor?: string,
      timeoutAt?: string,
    }
  ]
}

// POST /api/hermes/tasks/[id]/complete
Body: {
  mediaAssets?: [
    {
      fileUrl: string,       // URL setelah upload
      type: 'video' | 'photo',
      label?: string,
      category?: string,
      duration?: number,
    }
  ],
  contentLogId?: string,     // jika langsung posting
  notes?: string,
  metadata?: object,         // extra data dari worker
}
```

---

## 11. Perubahan Model Existing (Prisma Migration)

```prisma
// Product — tambah relasi LandingPage
model Product {
  // ... existing fields ...
  landingPages  LandingPage[]  // ← NEW
  mediaAssets   MediaAsset[]   // ← NEW (ganti photoReferences)
}

// InstagramAccount — tambah relasi MediaAsset
model InstagramAccount {
  // ... existing fields ...
  mediaAssets   MediaAsset[]   // ← NEW
}

// Character — tambah relasi MediaAsset
model Character {
  // ... existing fields ...
  mediaAssets   MediaAsset[]   // ← NEW
}

// HermesAgent — tambah capabilities + task relations
model HermesAgent {
  // ... existing fields ...
  capabilities  String[]      // ← NEW ['video_gen', 'photo_gen', 'posting']
  maxConcurrent Int @default(1) @map("max_concurrent") // ← NEW
  workerTasks   WorkerTask[]  // ← NEW
  mediaAssets   MediaAsset[]  // ← NEW (asset yang dibuat worker ini)
}
```

---

## 12. File Storage — Struktur Baru

```
/data/media/                    ← STORAGE_ROOT (ganti dari /data/photos)
  photos/
    {uuid}.jpg
    {uuid}.webp
  videos/
    {uuid}.mp4
    {uuid}.mov
  thumbnails/                   ← auto-generated dari video frame 1
    {uuid}.jpg

Serve via:
  GET /api/media/serve/photos/{uuid}.jpg
  GET /api/media/serve/videos/{uuid}.mp4
  GET /api/media/serve/thumbnails/{uuid}.jpg

Max file size:
  Photo: 10 MB
  Video: 500 MB (Railway Volume limit aware)

Auto-thumbnail:
  Saat upload video → ekstrak frame 1 detik → simpan sebagai thumbnail
  Library: ffmpeg atau sharp (perlu dicek Railway support)
```

---

## 13. Environment Variables — Tambahan MVP

```bash
# Existing (tidak berubah)
DATABASE_URL=
NEXT_PUBLIC_BASE_URL=
CRON_SECRET=
NODE_ENV=
STORAGE_ROOT=/data/media          # ← RENAME dari /data/photos

# New MVP
ALLOW_REGISTRATION=true            # Toggle self-serve registration
MAX_VIDEO_SIZE_MB=500              # Upload limit video
MAX_PHOTO_SIZE_MB=10               # Upload limit photo
WORKER_TASK_TIMEOUT_MINUTES=60     # Auto-fail task yang stuck
MEDIA_RULE_EVAL_INTERVAL=60        # Cron interval evaluasi rules (menit)
```

---

## 14. Migration Plan dari Existing ke MVP

```
Step 1 — Schema Migration
  - Buat model MediaAsset, LandingPage, LandingPageStat, WorkerTask,
    WorkerTaskResult, MediaLibraryRule
  - Rename STORAGE_ROOT /data/photos → /data/media
  - Migrate data PhotoReference → MediaAsset (type='photo')
  - Update FK di ContentLog yang reference PhotoReference

Step 2 — Storage Migration
  - Rename path di Railway Volume: /data/photos/ → /data/media/photos/
  - Update fileUrl di DB (batch update)
  - Update serve route: /api/photos/serve/ → /api/media/serve/
    (keep old route sebagai redirect selama transisi)

Step 3 — API Layer
  - Bangun /api/admin/media/* (replace /api/admin/photos/*)
  - Bangun /api/admin/products/[id]/landing-pages
  - Bangun /api/hermes/tasks (ganti extend ready-upload)
  - Update /api/hermes/library untuk include assets + LP
  - Bangun /api/cron/media-rules

Step 4 — Worker Protocol
  - Update semua existing Hermes worker untuk support task queue
  - Worker register capabilities saat startup
  - Keep backward compat: /api/hermes/ready-upload tetap berjalan
    selama semua worker belum upgrade

Step 5 — UI
  - Buat /media page (grid + upload)
  - Update /products/[id] untuk tab Landing Pages
  - Buat /workers & /workers/tasks
  - Buat /media-rules
```

---

## 15. Apa yang TIDAK Dibangun di MVP

Ini scope yang sengaja ditunda:

| Fitur | Alasan Ditunda |
|---|---|
| Meta Ads Manager integration | Butuh OAuth Meta + Advantage+ API (endpoint baru post-Oct 2025) — scope besar, Phase 2 |
| Meta CAPI proxy | Dependent pada Meta integration |
| ABO/CBO test orchestrator | Dependent pada Meta integration |
| CPAS / Shopee catalog | Belum ada verified spec, butuh riset lapangan |
| Billing / Stripe | Bisa pakai manual invoice dulu |
| Multi-tenant strict isolation | Foundation sudah ada (createdByUserId), cukup untuk MVP |
| Instagram Graph API | Metrics masih manual input, auto-fetch Phase 2 |
| Push notification | Nice to have |
| Video auto-thumbnail via ffmpeg | Jika Railway support, Phase 1.5 |

---

## 16. Success Metrics MVP

| Metric | Target |
|---|---|
| Client bisa daftar + setup akun IG sendiri | < 10 menit |
| Worker bisa claim + complete task | < 2 menit latency |
| Upload video < 500MB | Berhasil serve via CDN-like route |
| Media library rule trigger otomatis | Dalam 1 jam setelah kondisi terpenuhi |
| LP tracking: klik manual tercatat | Real-time di dashboard |
| Posting monitor loop | Berjalan tanpa intervensi manual |

---

## 17. Open Questions (Perlu Keputusan)

1. **Video thumbnail**: Pakai ffmpeg di server (butuh binary di Docker) atau generate di client saat upload?
2. **Worker push vs pull**: Task queue saat ini masih pull (worker polling). Push via webhook lebih real-time tapi butuh worker expose endpoint. Keputusan arsitektur?
3. **LP tracking via CAPI**: Klik ke LP bisa ditrack server-side (CAPI) atau hanya manual input dulu? → Phase 2 jika CAPI
4. **Self-serve pricing model**: Per akun IG? Per worker? Flat monthly? Tentukan sebelum billing dibangun.
5. **STORAGE_ROOT rename**: Perlu koordinasi dengan Railway Volume mount saat migration (ada downtime singkat)

---

*Blueprint ini dibuat berdasarkan: audit codebase Juni 2026 + deep research Meta Ads 2025 (106 agents, 24 sources, 5 verified claims dari 25) + gap analysis terhadap visi SaaS self-serve.*
