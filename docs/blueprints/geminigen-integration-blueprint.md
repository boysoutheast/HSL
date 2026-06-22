# Blueprint: GeminiGen Integration — Video Generation Layer

**Owner:** Boy Tenggara  
**Status:** DRAFT — awaiting execution  
**Scope:** HSL jadi proxy tunggal ke GeminiGen. Hermes, SaaS user, dan rule engine semua request ke HSL — tidak ada yang menyentuh GeminiGen langsung.

---

## 0. Fixed Constraints (tidak ada pilihan UI)

| Field | Value |
|---|---|
| model | `grok-video` |
| duration | `10` |
| aspect_ratio | `portrait` (9:16) |
| mode | `custom` |
| auth | `x-api-key` header |
| hasil delivery | webhook account-level (pure webhook, no polling di external API) |
| fallback | Dashboard API `GET /api/history/{uuid}` via Bearer (Supabase session) |

---

## 1. Arsitektur Flow

```
Caller (Hermes / SaaS user / Rule Engine)
  │
  ▼
POST /api/admin/generate/video
  ├─ validasi session / api key
  ├─ resolve image references → download URL dari Railway Volume
  ├─ buat generated_media row (status: queued)
  └─ enqueue worker_task: GENERATE_VIDEO (payload: jobId + imageUrls + prompt)
  │
  ▼
Worker (Contabo VPS)
  ├─ download images dari Railway Volume ke tmpdir
  ├─ POST https://api.geminigen.ai/uapi/v1/video-gen/grok (multipart)
  │   Header: x-api-key: GEMINIGEN_API_KEY
  │   Fields: prompt, model, aspect_ratio, duration, mode
  │   Files:  files=@img1.png, files=@img2.png (repeated key)
  ├─ GeminiGen returns: { uuid, status }
  ├─ update generated_media.externalJobId = uuid, status = processing
  └─ cleanup tmpdir
  │
  ▼
GeminiGen (async, seconds to minutes)
  │
  ▼
POST https://ai.boytenggara.com/api/webhooks/geminigen
  ├─ verifikasi X-GeminiGen-Secret header
  ├─ lookup generated_media by externalJobId
  ├─ update status = ready_for_rehost
  ├─ simpan rawWebhookJson
  └─ enqueue worker_task: REHOST_VIDEO
  │
  ▼
Worker: REHOST_VIDEO
  ├─ download dari file_download_url GeminiGen
  ├─ save ke /data/photos/generated/{id}.mp4
  ├─ update generated_media.videoUrl = /api/photos/serve/generated/{id}.mp4
  └─ update status = completed
  │
  ▼
Hermes / user pull
  GET /api/hermes/library → includes generated_media completed
  GET /api/admin/generate/video/:id → status + videoUrl
```

### Fallback: webhook miss

```
Cron tiap 15 menit (worker_task: SYNC_GEMINIGEN_HISTORY)
  ├─ query generated_media WHERE status IN (queued, processing)
  │   AND created_at < now - 5min
  ├─ untuk setiap row:
  │   GET https://api.geminigen.ai/api/history/{externalJobId}
  │   Header: Authorization: Bearer GEMINIGEN_DASHBOARD_TOKEN
  ├─ kalau status = completed → trigger REHOST_VIDEO
  └─ kalau status = failed → update generated_media status = failed
```

⚠️ `GEMINIGEN_DASHBOARD_TOKEN` = Supabase session token (Google OAuth). **Token ini expire** — perlu di-refresh manual dan update Railway env var. Bukan solusi permanent, tapi jadi safety net yang cukup.

---

## 2. Image Reference sebagai Jembatan

**Konsep:** generated_media tidak generate dari teks saja — selalu butuh satu atau lebih foto referensi dari `photo_references` table. Foto-foto ini yang jadi `files` di multipart request.

```
photo_references (existing table)
  └── instagram_account_id (persona photos, produk)

generated_media_inputs (new join table)
  ├── generated_media_id
  ├── photo_reference_id
  └── input_order (urutan file di multipart)
```

**UI picker di HSL:**
```
Generate Video
  ┌─────────────────────────────────────────┐
  │ Prompt (auto-fill dari persona + brief) │
  │ ─────────────────────────────────────── │
  │ Image References (1–5 gambar)           │
  │  [+ Tambah dari Media Library]          │
  │  [+ Tambah dari Produk]                 │
  │                                         │
  │  📷 img-a.png  [×]                     │
  │  📷 img-b.png  [×]                     │
  │                                         │
  │  [Generate →]                           │
  └─────────────────────────────────────────┘
```

Urutan gambar = urutan file di multipart. GeminiGen pakai urutan ini sebagai referensi visual sequence.

---

## 3. DB Schema

### Migration: `generated_media`

```sql
CREATE TABLE IF NOT EXISTS generated_media (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source            TEXT NOT NULL DEFAULT 'geminigen',
  model             TEXT NOT NULL DEFAULT 'grok-video',
  external_job_id   TEXT UNIQUE,          -- uuid dari GeminiGen response
  status            TEXT NOT NULL DEFAULT 'queued',
                                          -- queued | processing | ready_for_rehost
                                          -- completed | failed
  prompt            TEXT NOT NULL,
  instagram_account_id TEXT REFERENCES instagram_accounts(id) ON DELETE SET NULL,
  worker_task_id    TEXT REFERENCES worker_tasks(id) ON DELETE SET NULL,
  video_url         TEXT,                 -- Railway Volume path, setelah rehost
  thumbnail_url     TEXT,
  duration_seconds  INTEGER DEFAULT 10,
  raw_webhook_json  TEXT,
  raw_history_json  TEXT,                 -- dari fallback dashboard API
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

CREATE INDEX idx_generated_media_status ON generated_media(status);
CREATE INDEX idx_generated_media_external_job_id ON generated_media(external_job_id);
CREATE INDEX idx_generated_media_account ON generated_media(instagram_account_id);

CREATE TABLE IF NOT EXISTS generated_media_inputs (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  generated_media_id  TEXT NOT NULL REFERENCES generated_media(id) ON DELETE CASCADE,
  photo_reference_id  TEXT NOT NULL REFERENCES photo_references(id) ON DELETE RESTRICT,
  input_order         INTEGER NOT NULL DEFAULT 0
);
```

### Prisma Model (tambahkan ke schema.prisma)

```prisma
model GeneratedMedia {
  id                  String    @id @default(cuid())
  source              String    @default("geminigen")
  model               String    @default("grok-video")
  externalJobId       String?   @unique @map("external_job_id")
  status              String    @default("queued")
  prompt              String
  instagramAccountId  String?   @map("instagram_account_id")
  workerTaskId        String?   @map("worker_task_id")
  videoUrl            String?   @map("video_url")
  thumbnailUrl        String?   @map("thumbnail_url")
  durationSeconds     Int       @default(10) @map("duration_seconds")
  rawWebhookJson      String?   @map("raw_webhook_json")
  rawHistoryJson      String?   @map("raw_history_json")
  errorMessage        String?   @map("error_message")
  createdAt           DateTime  @default(now()) @map("created_at")
  completedAt         DateTime? @map("completed_at")

  instagramAccount  InstagramAccount? @relation(fields: [instagramAccountId], references: [id])
  workerTask        WorkerTask?       @relation(fields: [workerTaskId], references: [id])
  inputs            GeneratedMediaInput[]

  @@map("generated_media")
}

model GeneratedMediaInput {
  id                String  @id @default(cuid())
  generatedMediaId  String  @map("generated_media_id")
  photoReferenceId  String  @map("photo_reference_id")
  inputOrder        Int     @default(0) @map("input_order")

  generatedMedia  GeneratedMedia  @relation(fields: [generatedMediaId], references: [id], onDelete: Cascade)
  photoReference  PhotoReference  @relation(fields: [photoReferenceId], references: [id])

  @@map("generated_media_inputs")
}
```

---

## 4. HSL Endpoints

### `POST /api/admin/generate/video`
Trigger generate. Dipanggil dari UI atau Hermes via `/api/hermes/generate`.

```typescript
// Request
{
  prompt: string,
  instagramAccountId?: string,       // untuk context persona
  photoReferenceIds: string[],       // 1–5, urutan = urutan file
}

// Response
{
  generatedMediaId: string,
  status: "queued",
  message: "Job queued, result via webhook"
}
```

### `GET /api/admin/generate/video/:id`
Poll status (untuk UI loading state).

```typescript
// Response
{
  id, status, videoUrl, thumbnailUrl, prompt,
  inputs: [{ photoReferenceId, inputOrder }],
  createdAt, completedAt
}
```

### `POST /api/webhooks/geminigen`
Webhook receiver dari GeminiGen.

```typescript
// Header yang diverifikasi
X-GeminiGen-Secret: process.env.GEMINIGEN_WEBHOOK_SECRET

// Payload (dari info yang ada — sesuaikan saat testing)
{
  uuid: string,               // = externalJobId
  status: "completed" | "failed",
  generated_video: [{
    video_url: string,
    file_download_url: string,
    thumbnail_url?: string
  }]
}
```

### `GET /api/hermes/generated-media`
Hermes pull hasil generate yang completed, difilter by assignment.

---

## 5. Worker Task Types (tambahan ke worker VPS)

### `GENERATE_VIDEO`
```typescript
payload: {
  generatedMediaId: string,
  prompt: string,
  imageUrls: string[],     // Railway Volume URLs, worker download dulu
  apiKey: string           // GEMINIGEN_API_KEY dari env
}

flow:
  1. Download tiap imageUrl ke tmpdir
  2. POST multipart ke GeminiGen
  3. Dapat { uuid } dari response
  4. PATCH /api/internal/worker/tasks/:id → complete
  5. POST /api/internal/generated-media/:id → update externalJobId + status=processing
  6. Cleanup tmpdir
```

### `REHOST_VIDEO`
```typescript
payload: {
  generatedMediaId: string,
  fileDownloadUrl: string,    // URL dari GeminiGen (temporary)
  thumbnailUrl?: string
}

flow:
  1. Download video dari fileDownloadUrl
  2. Simpan ke /data/photos/generated/{generatedMediaId}.mp4
  3. Update generated_media.video_url = /api/photos/serve/generated/{id}.mp4
  4. Update status = completed, completed_at = now()
```

### `SYNC_GEMINIGEN_HISTORY` (fallback cron)
```typescript
payload: {}

flow:
  1. Query generated_media WHERE status IN (queued, processing)
       AND created_at < NOW() - INTERVAL '5 minutes'
  2. Untuk tiap row:
     GET https://api.geminigen.ai/api/history/{externalJobId}
     Authorization: Bearer GEMINIGEN_DASHBOARD_TOKEN
  3. Jika completed → queue REHOST_VIDEO
  4. Jika failed → update status=failed, error_message
```

---

## 6. Env Vars (Railway HSL)

```
GEMINIGEN_API_KEY=<x-api-key dari GeminiGen dashboard>
GEMINIGEN_WEBHOOK_SECRET=<random string, set juga di GeminiGen account webhook config>
GEMINIGEN_DASHBOARD_TOKEN=<Supabase session Bearer token — perlu refresh manual>
```

Env Vars (Worker VPS `.env`):
```
GEMINIGEN_API_KEY=<sama>
GEMINIGEN_DASHBOARD_TOKEN=<sama>
```

---

## 7. Webhook Setup di GeminiGen Dashboard

Setelah deploy:
1. Login ke geminigen.ai
2. Settings → Webhook URL → set ke:
   `https://ai.boytenggara.com/api/webhooks/geminigen`
3. Webhook secret → masukkan value dari `GEMINIGEN_WEBHOOK_SECRET`
4. Save

**Satu webhook URL untuk semua generate** — disambiguasi via `uuid` di payload.

---

## 8. Hal yang Perlu Dikonfirmasi Saat Testing

- [ ] Exact field names di webhook payload (konfirm `uuid` vs `job_id`, `generated_video` vs `result`)
- [ ] Apakah `file_download_url` expire? (berapa lama valid?)
- [ ] Response body dari POST `/uapi/v1/video-gen/grok` — field `uuid` atau `id`?
- [ ] `GEMINIGEN_DASHBOARD_TOKEN` refresh interval — kapan expire?

Kalau ada discrepancy di webhook payload, tinggal update `POST /api/webhooks/geminigen` handler — schema DB tidak perlu berubah karena `rawWebhookJson` menyimpan full payload.

---

## 9. Eksekusi Order

1. **Migration** — `generated_media` + `generated_media_inputs` + Prisma schema
2. **Webhook endpoint** `POST /api/webhooks/geminigen`
3. **Admin API** `POST /api/admin/generate/video` + `GET /api/admin/generate/video/:id`
4. **Worker handlers**: `GENERATE_VIDEO` + `REHOST_VIDEO`
5. **Hermes API** `GET /api/hermes/generated-media`
6. **Fallback**: `SYNC_GEMINIGEN_HISTORY` + cron schedule
7. **UI**: image picker + generate button + status polling di halaman Media Library atau Generate page

*Sonnet eksekusi sesuai urutan ini. DILARANG force-push ke main.*
