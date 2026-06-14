# Hermes Agent — Video Generation Blueprint

**Version:** 1.0.0 | **Date:** 2026-06-14 | **Status:** READY

Blueprint untuk Hermes agent yang ingin generate video via HSL. Mencakup:
- Generate flow (submit job → worker pick-up → GeminiGen)
- Polling/waiting flow (cek status → dapatkan videoUrl)
- Webhook + polling fallback (2 jalur delivery)

---

## Prasyarat Hermes Agent

1. **API Key HSL** — format `hsk_...` (prefix 12 char)
   - Admin HSL harus bikin API key di `/system` → tab Connections
   - Key linked ke admin user yang punya credits
2. **Auth header** — semua request pakai:
   ```
   Authorization: Bearer hsk_XXXXXXXXXXXX
   ```
   Atau:
   ```
   x-api-key: hsk_XXXXXXXXXXXX
   ```
3. **Credits** — user harus punya cukup credits untuk generate:
   - SD + 6 detik = 1000 credits
   - SD + 10 detik = 1300 credits
   - HD + 6 detik = 2000 credits
   - HD + 10 detik = 2600 credits

---

## Dua Jalur Auth

HSL punya 2 sistem auth untuk generate video:

| Jalur | Auth | Prefix | Endpoint | Status |
|---|---|---|---|---|
| **User API Key** | `requireApiKey` → `userApiKey` → `adminUser` | `hsk_...` | `/api/gen/*` | ✅ **READY** |
| **Hermes Agent Key** | `validateHermesApiKey` → `hermesAgent` | (random) | `/api/hermes/*` | 🔶 Stub redirect ke gen |

**Rekomendasi untuk Hermes agent sekarang:** Pakai jalur User API Key (`hsk_...`)
karena sudah production-ready. Admin HSL bikin API key di `/system` → Connections tab.

## Endpoint

Base URL: `https://ai.boytenggara.com`

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| POST | `/api/gen/video` | `hsk_...` | Submit video generation job |
| GET | `/api/gen/video` | `hsk_...` | List jobs (+ filter status) |
| GET | `/api/gen/video/[id]` | `hsk_...` | Poll single job status |
| GET | `/api/gen/credits` | `hsk_...` | Cek credit balance |

---

## 1. Generate Flow

### 1.1 Submit Job

```
POST /api/gen/video
Authorization: Bearer hsk_XXXXXXXXXXXX
Content-Type: application/json

{
  "prompt": "A woman applying body lotion after shower, soft lighting, clean bathroom",
  "orientation": "portrait",
  "resolution": "SD",
  "durationSeconds": 6,
  "photoReferenceIds": []
}
```

**Parameters:**

| Field | Type | Required | Default | Deskripsi |
|---|---|---|---|---|
| `prompt` | string | ✅ | — | Deskripsi video yang mau digenerate (Bahasa Indonesia OK) |
| `orientation` | string | ❌ | `"portrait"` | `"portrait"` / `"landscape"` |
| `resolution` | string | ❌ | `"SD"` | `"SD"` / `"HD"` |
| `durationSeconds` | number | ❌ | `10` | `6` atau `10` |
| `photoReferenceIds` | string[] | ❌ | `[]` | Array ID foto referensi (dari endpoint upload photo) |

**Success Response (201):**

```json
{
  "id": "abc123def456",
  "creditsCost": 1000,
  "balanceAfter": 9000
}
```

| Field | Deskripsi |
|---|---|
| `id` | GeneratedMedia ID — simpan untuk polling |
| `creditsCost` | Credits yang terpotong |
| `balanceAfter` | Sisa credits user |

**Error Responses:**

| Status | Body | Penyebab |
|---|---|---|
| 400 | `{"error":"prompt is required"}` | Prompt kosong |
| 401 | `{"error":"Unauthorized"}` | API key invalid/missing |
| 402 | `{"error":"Insufficient credits","balance":X,"required":Y}` | Credits kurang |
| 500 | `{"error":"..."}` | Server error |

### 1.2 Lifecycle Internal

Setelah submit, yang terjadi:

```
[1] generated_media.status = "queued"
    worker_task.type = "GENERATE_VIDEO", status = "pending"

[2] Hermes Worker claim GENERATE_VIDEO task
    → Download foto referensi (jika ada)
    → POST GeminiGen Grok API
    → PATCH generated_media.externalJobId = uuid
    → generated_media.status = "processing"
    → Schedule POLL_GEMINIGEN fallback

[3a] GeminiGen selesai → webhook → /api/webhooks/geminigen
     → HSL cek UUID match
     → generated_media.status = "ready_for_rehost"
     → Queue worker_task.REHOST_VIDEO

[3b] ATAU — POLL_GEMINIGEN (polling fallback)
     → GET GeminiGen history API
     → Status 2 (completed) → trigger REHOST_VIDEO langsung

[4] Hermes Worker claim REHOST_VIDEO
    → Download video dari GeminiGen CDN
    → Upload ke HSL storage
    → PATCH generated_media: videoUrl, status = "completed"
```

**Estimasi waktu:** 2-5 menit dari submit sampai completed (tergantung antrian GeminiGen).

---

## 2. Polling / Waiting Flow

### 2.1 List Jobs

```
GET /api/gen/video?limit=20&offset=0
Authorization: Bearer hsk_XXXXXXXXXXXX
```

**Response:**

```json
{
  "items": [
    {
      "id": "abc123def456",
      "status": "completed",
      "prompt": "A woman applying body lotion...",
      "mediaType": "VIDEO",
      "creditsCost": 1000,
      "videoUrl": "https://storage.boytenggara.com/videos/abc123.mp4",
      "thumbnailUrl": "https://storage.boytenggara.com/thumbnails/abc123.jpg",
      "durationSeconds": 6,
      "errorMessage": null,
      "createdAt": "2026-06-14T10:00:00.000Z",
      "completedAt": "2026-06-14T10:03:00.000Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

**Status values:**

| Status | Arti |
|---|---|
| `queued` | Job baru dibuat, worker belum ambil |
| `processing` | Worker sudah kirim ke GeminiGen |
| `ready_for_rehost` | Video selesai di GeminiGen, siap download |
| `completed` | Video sudah di-upload ke HSL storage |
| `failed` | Error — cek `errorMessage` |

### 2.2 Poll Sampai Completed

```
Loop:
  1. GET /api/gen/video?limit=5
  2. Cari job dengan id yang di-track
  3. Kalau status = "completed" → ambil videoUrl → STOP
  4. Kalau status = "failed" → baca errorMessage → STOP error
  5. Kalau status lain → sleep 5 detik → ulangi
```

**Rekomendasi interval:** 5 detik. **Max timeout:** 10 menit (setelah itu anggap failed/tak terjawab).

**Contoh flow:**

```python
# Submit
resp = requests.post(f'{HSL}/api/gen/video', json={...}, headers={...})
job_id = resp.json()['id']

# Poll
while True:
    resp = requests.get(f'{HSL}/api/gen/video?limit=10', headers={...})
    job = next((j for j in resp.json()['items'] if j['id'] == job_id), None)
    if not job:
        raise Exception('Job disappeared')
    if job['status'] == 'completed':
        return job['videoUrl']
    if job['status'] == 'failed':
        raise Exception(job.get('errorMessage', 'Unknown error'))
    time.sleep(5)
```

---

## 3. Poll Single Job (Alternative)

Kalau sudah tahu ID-nya, bisa langsung cek:

```
GET /api/gen/video?id=abc123def456
Authorization: Bearer hsk_XXXXXXXXXXXX
```

Response sama dengan item di list, tapi single object (bukan array).

---

## 4. Photo Reference Upload (Optional)
## 4. Photo Reference (Optional — Read Only via Hermes Agent)

Kalau mau generate video dengan foto referensi, Hermes agent bisa GET existing photos:

```
GET /api/hermes/photos?productId=X&category=product
Authorization: Bearer ***
```

**Response:**
```json
{
  "photos": [{ "id": "photo_abc123", "fileUrl": "...", "filename": "reference.png" }],
  "total": 1
}
```

Gunakan `photoReferenceIds` yang didapat di POST /api/gen/video.

> ⚠️ **Upload foto (POST) belum ada di endpoint Hermes agent.** Foto harus di-upload via HSL UI
> terlebih dahulu oleh admin. Hermes agent hanya bisa membaca foto yang sudah di-assign ke agent-nya.

---

## 5. Agent-Ready Checklist

Sebelum Hermes agent bisa generate video, pastiin:

- [ ] HSL admin sudah setup API key (`hsk_...`) untuk Hermes agent
- [ ] User yang punya API key punya credits cukup
- [ ] `GEMINIGEN_API_KEY` di Railway valid (tidak expired)
- [ ] Hermes Worker running dan bisa claim tasks
- [ ] Webhook URL `https://hsl.boytenggara.com/api/webhooks/geminigen` sudah di-set di GeminiGen dashboard
- [ ] Test: submit job → poll 3 menit → dapatkan videoUrl
