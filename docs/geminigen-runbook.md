# GeminiGen Video Gen — Setup & Troubleshooting Runbook

## Prasyarat

Owner HSL harus sudah setup 3 env di Railway:

| Env | Nilai | Dari mana |
|---|---|---|
| `GEMINIGEN_API_KEY` | API key GeminiGen | `https://geminigen.ai/profile/integration/api-keys` → Generate → Copy |
| `GEMINIGEN_WEBHOOK_SECRET` | Secret untuk verifikasi webhook | Bikin sendiri (min 32 char random). Nilai yang SAMA harus di-set di GeminiGen Dashboard. |
| `GEMINIGEN_DASHBOARD_TOKEN` | Token polling dashboard | Opsional — butuh Supabase session token (Google OAuth) dari dashboard. Hanya untuk troubleshooting manual. |

## Setup Webhook URL di GeminiGen

1. Buka `https://geminigen.ai/profile/integration/webhook`
2. Set URL: `https://hsl.boytenggara.com/api/webhooks/geminigen`
3. Set Secret: sama dengan `GEMINIGEN_WEBHOOK_SECRET` di Railway
4. Save

> ⚠️ Webhook URL harus HTTPS dan reachable dari internet. Kalau pakai localhost/tunnel, jangan dipakai di production.

## Flow Lengkap

```
UI (Media → Generate)
  │
  ▼
POST /api/admin/generate/video
  ├── Buat generated_media (status: queued)
  ├── Simpan generated_media_inputs (photoReferenceIds)
  └── Bikin worker_task GENERATE_VIDEO (status: pending)
  │
  ▼
Hermes Worker (poll worker_task)
  ├── Claim task → status: processing
  ├── GET /api/internal/photo-references/batch → resolve foto
  ├── Download foto → multipart POST ke GeminiGen Grok
  │     POST https://api.geminigen.ai/uapi/v1/video-gen/grok
  │     Header: x-api-key = GEMINIGEN_API_KEY
  │     Form: prompt, aspect_ratio=portrait, duration=10
  │     File: image_reference
  ├── PATCH generated_media (externalJobId=uuid, status=processing)
  └── Return {mode: video_gen_submitted}
  │
  ▼
GeminiGen (async processing ~2-5 menit)
  └── Webhook callback ke HSL saat selesai
  │
  ▼
POST /api/webhooks/geminigen
  ├── Secret check OPTIONAL — GeminiGen does not send x-geminigen-secret.
  │     If both GEMINIGEN_WEBHOOK_SECRET and header present → verified.
  │     If header absent → still processes (UUID-based auth).
  ├── Extract UUID from payload.data.uuid
  ├── Match UUID to generatedMedia.externalJobId
  ├── Unknown UUID → 200 skip (not error)
  ├── status completed (2) → bikin worker_task REHOST_VIDEO
  └── Return 200 OK
  │
  ▼
Hermes Worker (poll REHOST_VIDEO)
  ├── Download video dari media_url (webhook payload)
  ├── POST /api/internal/media/upload-video → /data/photos/generated/
  ├── PATCH generated_media (videoUrl, thumbnailUrl, status=completed, completedAt)
  └── Selesai
```

## Troubleshooting

### Job stuck "queued" (tidak jadi processing)
- **Penyebab:** Worker tidak jalan / GEMINIGEN_API_KEY belum di-set
- **Cek:** Lihat worker_task terkait di DB — apakah ada task GENERATE_VIDEO dengan status pending?
- **Fix:** Pastikan Hermes worker run dan env GEMINIGEN_API_KEY sudah di-set

### Job stuck "processing" (tidak jadi completed)
- **Penyebab:** Webhook URL salah, tidak reachable, atau secret mismatch
- **Cek:** 
  1. `curl https://hsl.boytenggara.com/api/webhooks/geminigen -X POST -H "x-geminigen-secret: <secret>" -d '{}'` → harus return 401 (bukan timeout/connection refused)
  2. Cek Railway log untuk error webhook
- **Fix:** Pastikan webhook URL di GeminiGen dashboard benar + secret match

### Webhook 401 (secret mismatch)
- **Penyebab:** `GEMINIGEN_WEBHOOK_SECRET` di Railway tidak sama dengan yang diharapkan.
- **Catatan:** Sejak 2026-06-14, secret webhook bersifat OPTIONAL. GeminiGen tidak mengirim header secret. Webhook handler HSL menerima callback tanpa header secret dan melakukan auth berbasis UUID.
- **Fix:** Kalau ingin secret wajib, set `GEMINIGEN_WEBHOOK_SECRET` di Railway dan pastikan GeminiGen dashboard mengirim header `x-geminigen-secret` yang sama. Kalau tidak, kosongkan saja env-nya.

### Job status "failed"
- **Cek:** Lihat `errorMessage` di generated_media row
- **Penyebab umum:**
  - GeminiGen API error (cek lastError di worker task)
  - Foto referensi invalid (404 / not found)
  - Storage penuh (Railway volume `/data/photos/`)
- **Fix:** Tergantung error. Kalau GeminiGen internal error → retry job

### Video tidak muncul di UI walau status completed
- **Penyebab:** REHOST_VIDEO gagal / videoUrl null
- **Cek:** Lihat generated_media row — apakah videoUrl terisi?
- **Fix:** Kalau null, cek worker task REHOST_VIDEO — apakah completed atau failed?

### Job stuck "ready_for_rehost" (REHOST tidak jalan)
- **Penyebab:** Worker tidak claim task REHOST_VIDEO / upload gagal
- **Cek:** Lihat worker task REHOST_VIDEO — status + lastError
- **Fix:** Cek storage `/data/photos/generated/` penuh? Worker running?

### POLL_GEMINIGEN — polling fallback
- Setelah GENERATE_VIDEO submit, worker auto-schedule POLL_GEMINIGEN task
- Poll setiap ~60 detik via `GET /history/{jobId}` di GeminiGen API
- Kalau webhook gak pernah datang, poll jadi fallback
- Poll punya guard anti-double-REHOST: cek GM.status dulu — kalau udah `completed`/`ready_for_rehost`, skip
- `maxAttempts=10` → ~10 menit total polling sebelum dead letter

### Auto-Refund (worker failure)
- Kalau GENERATE_VIDEO task gagal di worker → auto-call `POST /api/internal/generated-media/{id}/refund`
- Refund idempotent — cek `refundedAt`, pakai `idempotencyKey`
- Credit dikembalikan ke user balance dengan creditTransaction `reason=refund`
- Kalau refund gagal → error logged ke stderr, task tetap marked failed

## Cek Manual (Admin)

```bash
# Cek semua job
curl -H "Cookie: session=<admin-session>" \
  https://hsl.boytenggara.com/api/admin/generate/video?limit=5 | jq .

# Cek job spesifik
curl -H "Cookie: session=<admin-session>" \
  https://hsl.boytenggara.com/api/admin/generate/video/<id> | jq .

# Cek worker tasks terkait
# Via Prisma Studio / DB query: SELECT * FROM worker_tasks WHERE type IN ('GENERATE_VIDEO','REHOST_VIDEO') ORDER BY created_at DESC LIMIT 10;
```

## Hermes Agent — Ambil Hasil

```
GET /api/hermes/generated-media?status=completed&limit=20
Authorization: Bearer <hermes-api-key>
```

Response: `{ items: [{ id, videoUrl, thumbnailUrl, prompt, durationSeconds, completedAt }], pagination: {...} }`

Endpoint ini scoped assignment — Hermes agent hanya lihat media dari IG account yang di-assign.
