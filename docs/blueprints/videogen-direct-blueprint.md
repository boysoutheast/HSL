# Blueprint: Video Gen — Direct HSL→GeminiGen (Hapus Worker Dependency)

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION
**Estimasi:** 20–30 menit (Sonnet nonstop)
**Masalah:** Video gen lewat Worker → Worker mati = semua job stuck forever
**Solusi:** HSL langsung call GeminiGen, cron poll status, webhook sebagai fallback

---

## Arsitektur Baru

```
POST /api/gen/video
  ├── Debit credits
  ├── Buat GeneratedMedia (status=queued)
  ├── Langsung POST ke GeminiGen API
  ├── Simpan externalJobId, set status=processing
  └── Return 202 { id, status: 'processing' }

(async, setiap 2 menit)
Railway Cron → GET /api/cron/poll-geminigen
  ├── Ambil semua GeneratedMedia status=processing dengan externalJobId
  ├── Per job: GET GeminiGen /history/{uuid}
  ├── done → download video → upload Railway Volume → status=completed
  ├── failed → status=failed → refund credits
  └── timeout (>20 mnt) → status=failed → refund credits

(opsional, jika GeminiGen webhook reliable)
POST /api/webhooks/geminigen
  ├── status=2 completed → langsung download+rehost+completed (tanpa worker)
  └── status=3 failed → status=failed → refund credits
```

**Yang dihapus:** WorkerTask GENERATE_VIDEO dan REHOST_VIDEO tidak dibuat lagi.
**Worker tetap** untuk Meta campaign ops (tidak disentuh blueprint ini).

---

## File yang Diubah / Dibuat

### 1. `src/lib/geminigen.ts` — NEW

Client GeminiGen. Semua akses GeminiGen lewat sini.

```ts
export interface GeminiGenSubmitParams {
  prompt: string
  aspectRatio: string      // 'portrait' | 'landscape' | 'square'
  durationSeconds: number  // 6 | 10
  imageUrls?: string[]     // photo references (opsional)
}

export interface GeminiGenJobStatus {
  uuid: string
  status: number           // 1=processing, 2=completed, 3=failed
  mediaUrl: string | null
  thumbnailUrl: string | null
}

const BASE = 'https://api.geminigen.ai/uapi/v1'

function apiKey(): string {
  const k = process.env.GEMINIGEN_API_KEY
  if (!k) throw new Error('GEMINIGEN_API_KEY not set')
  return k
}

// Submit video job ke GeminiGen
// Returns: uuid (external job id)
export async function submitVideoJob(params: GeminiGenSubmitParams): Promise<string> {
  // Form: prompt, aspect_ratio, duration, image_reference (file URL atau upload)
  const form = new FormData()
  form.append('prompt', params.prompt)
  form.append('aspect_ratio', params.aspectRatio)
  form.append('duration', String(params.durationSeconds))

  // Kalau ada image references, fetch dan lampirkan sebagai file
  // GeminiGen API: field name 'image_reference', bisa URL atau binary
  if (params.imageUrls && params.imageUrls.length > 0) {
    // Ambil gambar pertama (GeminiGen support 1 reference image)
    const imgRes = await fetch(params.imageUrls[0])
    if (imgRes.ok) {
      const blob = await imgRes.blob()
      form.append('image_reference', blob, 'reference.jpg')
    }
  }

  const res = await fetch(`${BASE}/video-gen/grok`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey() },
    body: form,
  })

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown error')
    throw new Error(`GeminiGen submit failed ${res.status}: ${err}`)
  }

  const data = await res.json()
  const uuid = data?.uuid ?? data?.data?.uuid ?? data?.job_id
  if (!uuid || typeof uuid !== 'string') {
    throw new Error(`GeminiGen submit: no uuid in response: ${JSON.stringify(data)}`)
  }
  return uuid
}

// Poll status job dari GeminiGen
export async function pollJobStatus(uuid: string): Promise<GeminiGenJobStatus> {
  const res = await fetch(`${BASE}/video-gen/history/${uuid}`, {
    headers: { 'x-api-key': apiKey() },
  })

  if (!res.ok) {
    throw new Error(`GeminiGen poll failed ${res.status} for uuid ${uuid}`)
  }

  const data = await res.json()
  // Response shape: { uuid, status, media_url, thumbnail_url }
  // atau nested: { data: { uuid, status, ... } }
  const d = data?.data ?? data
  return {
    uuid: d.uuid ?? uuid,
    status: typeof d.status === 'number' ? d.status : 1,
    mediaUrl: d.media_url ?? d.mediaUrl ?? null,
    thumbnailUrl: d.thumbnail_url ?? d.thumbnailUrl ?? null,
  }
}
```

**⚠️ PENTING**: Jika GeminiGen API shape berbeda dari asumsi di atas, sesuaikan berdasarkan error yang muncul. Jangan assume — baca response actual.

---

### 2. `src/lib/video-rehost.ts` — NEW

Download video dari CDN GeminiGen, upload ke Railway Volume.

```ts
import { uploadFile } from '@/lib/storage'

// Download video dari URL CDN, upload ke Railway Volume
// Returns: permanent Railway Volume URL
export async function rehostVideo(
  sourceUrl: string,
  jobId: string,
): Promise<string> {
  const res = await fetch(sourceUrl, {
    headers: { 'User-Agent': 'HSL/1.0' },
  })
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${sourceUrl}`)

  const arrayBuffer = await res.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Deteksi ekstensi dari URL atau default mp4
  const ext = sourceUrl.split('?')[0].split('.').pop()?.toLowerCase() ?? 'mp4'
  const safeExt = /^(mp4|webm|mov)$/.test(ext) ? ext : 'mp4'
  const filename = `videos/${jobId}.${safeExt}`

  const uploadedUrl = await uploadFile(buffer, filename, `video/${safeExt}`)
  return uploadedUrl
}

// Download thumbnail jika ada
export async function rehostThumbnail(
  sourceUrl: string,
  jobId: string,
): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const ext = sourceUrl.split('?')[0].split('.').pop()?.toLowerCase() ?? 'jpg'
    const safeExt = /^(jpg|jpeg|png|webp)$/.test(ext) ? ext : 'jpg'
    return await uploadFile(buf, `thumbs/${jobId}.${safeExt}`, `image/${safeExt}`)
  } catch {
    return null
  }
}
```

Cek signature `uploadFile` di `src/lib/storage.ts` — sesuaikan parameter jika perlu.

---

### 3. `src/app/api/gen/video/route.ts` — EDIT POST handler

Hapus bagian `workerTask.create`. Ganti dengan direct GeminiGen call.

**POST handler baru (ganti seluruh isi transaction dan setelahnya):**

```ts
// Di dalam $transaction:
// HAPUS bagian ini:
// await tx.workerTask.create({ data: { type: 'GENERATE_VIDEO', ... } })

// Setelah transaction (bukan di dalam):
// Langsung submit ke GeminiGen
let externalJobId: string | null = null
try {
  const { submitVideoJob } = await import('@/lib/geminigen')

  // Resolve photo URLs kalau ada
  let imageUrls: string[] = []
  if (photoReferenceIds.length > 0) {
    const photos = await prisma.photoReference.findMany({
      where: { id: { in: photoReferenceIds } },
      select: { fileUrl: true },
    })
    imageUrls = photos.map(p => p.fileUrl)
  }

  const aspectRatio = (body.orientation || 'portrait') === 'landscape'
    ? 'landscape'
    : (body.orientation || 'portrait') === 'square'
    ? 'square'
    : 'portrait'

  externalJobId = await submitVideoJob({
    prompt,
    aspectRatio,
    durationSeconds: duration,
    imageUrls,
  })

  // Simpan externalJobId + set processing
  await prisma.generatedMedia.update({
    where: { id: result.id },
    data: { externalJobId, status: 'processing' },
  })

} catch (err) {
  // Submit ke GeminiGen gagal → refund credits + set failed
  console.error('[gen/video] GeminiGen submit failed:', err)
  await prisma.$transaction([
    prisma.generatedMedia.update({
      where: { id: result.id },
      data: { status: 'failed', errorMessage: String(err) },
    }),
    // Refund: increment balance balik
    prisma.adminUser.update({
      where: { id: user.id },
      data: { creditBalance: { increment: creditsCost } },
    }),
  ])
  return NextResponse.json({ error: 'Video generation service unavailable. Credits refunded.' }, { status: 503 })
}

return NextResponse.json(
  { id: result.id, status: 'processing', creditsCost, balanceAfter: result.balanceAfter },
  { status: 201 }
)
```

**⚠️ Juga hapus**: import WorkerTask-related code yang tidak lagi dibutuhkan.

---

### 4. `src/app/api/cron/poll-geminigen/route.ts` — NEW

Cron endpoint yang dipanggil Railway setiap 2 menit.

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pollJobStatus } from '@/lib/geminigen'
import { rehostVideo, rehostThumbnail } from '@/lib/video-rehost'
import { refundCredits } from '@/lib/credits'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Vercel: 60s max, Railway: unlimited

const TIMEOUT_MINUTES = 20    // Job stuck >20 mnt → fail
const MAX_CONCURRENT = 5      // Poll maks 5 job per run (hindari overload)

export async function GET(req: NextRequest) {
  // Auth via cron secret
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - TIMEOUT_MINUTES * 60 * 1000)

  // Ambil jobs yang perlu di-poll
  const jobs = await prisma.generatedMedia.findMany({
    where: {
      status: 'processing',
      externalJobId: { not: null },
    },
    orderBy: { createdAt: 'asc' },
    take: MAX_CONCURRENT,
    select: {
      id: true,
      externalJobId: true,
      userId: true,
      creditsCost: true,
      createdAt: true,
    },
  })

  const results = { polled: 0, completed: 0, failed: 0, timeout: 0, errors: 0 }

  for (const job of jobs) {
    results.polled++

    // Timeout check
    if (job.createdAt < cutoff) {
      results.timeout++
      await prisma.generatedMedia.update({
        where: { id: job.id },
        data: { status: 'failed', errorMessage: 'Timeout: job exceeded 20 minutes' },
      })
      // Refund credits
      if (job.userId && job.creditsCost) {
        await refundByJobId(job.id, job.userId, job.creditsCost)
      }
      continue
    }

    try {
      const status = await pollJobStatus(job.externalJobId!)

      if (status.status === 2 && status.mediaUrl) {
        // COMPLETED — download + rehost
        const videoUrl = await rehostVideo(status.mediaUrl, job.id)
        const thumbnailUrl = status.thumbnailUrl
          ? await rehostThumbnail(status.thumbnailUrl, job.id)
          : null

        await prisma.generatedMedia.update({
          where: { id: job.id },
          data: {
            status: 'completed',
            videoUrl,
            thumbnailUrl,
            completedAt: new Date(),
            errorMessage: null,
          },
        })
        results.completed++

      } else if (status.status === 3) {
        // FAILED
        await prisma.generatedMedia.update({
          where: { id: job.id },
          data: { status: 'failed', errorMessage: 'GeminiGen reported generation failed' },
        })
        if (job.userId && job.creditsCost) {
          await refundByJobId(job.id, job.userId, job.creditsCost)
        }
        results.failed++
      }
      // status === 1 (still processing) → skip, poll lagi next run

    } catch (err) {
      results.errors++
      console.error(`[poll-geminigen] Error polling job ${job.id}:`, err)
      // Jangan fail job hanya karena poll error (network hiccup)
      // Timeout handler akan cleanup kalau terlalu lama
    }
  }

  return NextResponse.json({ ok: true, ...results, ts: new Date().toISOString() })
}

// Helper: refund credits untuk job yang gagal
async function refundByJobId(jobId: string, userId: string, creditsCost: number) {
  const key = `cron_refund_${jobId}`
  const existing = await prisma.creditTransaction.findUnique({ where: { idempotencyKey: key } })
  if (existing) return

  await prisma.$transaction(async (tx) => {
    const u = await tx.adminUser.update({
      where: { id: userId },
      data: { creditBalance: { increment: creditsCost } },
      select: { creditBalance: true },
    })
    await tx.creditTransaction.create({
      data: {
        userId,
        amount: creditsCost,
        reason: 'video_generation_refund',
        refId: jobId,
        refType: 'generated_media',
        balanceAfter: u.creditBalance,
        idempotencyKey: key,
      },
    })
    await tx.generatedMedia.update({
      where: { id: jobId },
      data: { refundedAt: new Date() },
    })
  })
}
```

---

### 5. `src/app/api/webhooks/geminigen/route.ts` — EDIT

Hapus `workerTask.create` REHOST_VIDEO. Ganti dengan download+rehost langsung.

**Ganti bagian `numericStatus === 2`:**
```ts
if (numericStatus === 2 && mediaUrl) {
  // COMPLETED — langsung rehost (bukan via worker)
  try {
    const { rehostVideo, rehostThumbnail } = await import('@/lib/video-rehost')
    const videoUrl = await rehostVideo(mediaUrl, generatedMedia.id)
    const finalThumb = thumbnailUrl
      ? await rehostThumbnail(thumbnailUrl, generatedMedia.id)
      : null

    await prisma.generatedMedia.update({
      where: { id: generatedMedia.id },
      data: {
        status: 'completed',
        videoUrl,
        thumbnailUrl: finalThumb,
        rawWebhookJson,
        completedAt: new Date(),
        errorMessage: null,
      },
    })
    return NextResponse.json({ ok: true, action: 'completed' })
  } catch (err) {
    // Rehost gagal → jangan crash webhook, biarkan cron pickup
    console.error('[webhook/geminigen] rehost failed, will retry via cron:', err)
    await prisma.generatedMedia.update({
      where: { id: generatedMedia.id },
      data: { rawWebhookJson }, // simpan payload, status tetap processing
    })
    return NextResponse.json({ ok: true, action: 'rehost_pending' })
  }
}
```

**Juga hapus** import `workerTask` dan type `REHOST_VIDEO` dari webhook handler ini.

---

### 6. Railway Cron Service — BUAT BARU

Tambah di Railway project (sama seperti cron-posting-monitor):

```
Name: cron-poll-geminigen
Command: curl -fsS -L -X GET https://ai.boytenggara.com/api/cron/poll-geminigen -H "x-cron-secret: $CRON_SECRET"
Schedule: */2 * * * *   (setiap 2 menit)
```

**Cara buat via Railway CLI / MCP** (setelah deploy):
- Railway Dashboard → New Service → Empty Service
- Name: `cron-poll-geminigen`
- Start Command: `curl -fsS -L -X GET https://ai.boytenggara.com/api/cron/poll-geminigen -H "x-cron-secret: $CRON_SECRET"`
- Set cron trigger `*/2 * * * *`
- Tambah env `CRON_SECRET` (reference dari service lain)

---

### 7. `src/app/api/admin/generate/video/route.ts` — EDIT (jika ada)

Jika ada admin endpoint ini, samakan pattern: hapus workerTask, langsung call GeminiGen.

---

## Status Flow GeneratedMedia

```
queued       → processing    (setelah submit berhasil ke GeminiGen)
processing   → completed     (cron/webhook: download+rehost berhasil)
processing   → failed        (cron: timeout 20mnt, atau GeminiGen status=3)
failed       → (refund)      (credits dikembalikan otomatis)
```

Hapus status `ready_for_rehost` — tidak dipakai lagi.

---

## Self-Heal Mechanisms

| Skenario | Handler | Action |
|---|---|---|
| GeminiGen submit error | POST /api/gen/video | Langsung refund, return 503 |
| GeminiGen lambat/delay | cron poll tiap 2 mnt | Retry sampai timeout |
| Job stuck >20 mnt | cron timeout check | Auto-fail + refund |
| Webhook rehost error | webhook handler catch | Keep status=processing, cron akan pickup |
| Cron gagal 1 run | Cron berikutnya 2 mnt | Auto-recover, idempotent |
| Double-complete (webhook + cron) | Check status != 'processing' | Skip (already done) |
| Credits double-refund | idempotencyKey per jobId | Hanya refund sekali |

---

## Smoke Tests (Jalankan Setelah Deploy)

### T1: Submit job berhasil

```bash
curl -X POST https://ai.boytenggara.com/api/gen/video \
  -H "x-api-key: <user_api_key>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test video landscape", "resolution":"SD", "durationSeconds":6}'

# Expected: 201 { id: "...", status: "processing", creditsCost: 1000 }
# Status harus "processing" (bukan "queued") — artinya sudah dikirim ke GeminiGen
```

### T2: Poll status

```bash
curl https://ai.boytenggara.com/api/gen/video/<id> \
  -H "x-api-key: <user_api_key>"

# Tunggu 2-5 menit → status: "completed", videoUrl: "https://..."
```

### T3: Cron poll manual

```bash
curl -X GET https://ai.boytenggara.com/api/cron/poll-geminigen \
  -H "x-cron-secret: <CRON_SECRET>"

# Expected: { ok: true, polled: N, completed: N, failed: 0, timeout: 0, errors: 0 }
```

### T4: Credit check — insufficient balance

```bash
curl -X POST https://ai.boytenggara.com/api/gen/video \
  -H "x-api-key: <key_dengan_saldo_0>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test"}'

# Expected: 402 { error: "Insufficient credits", balance: 0, required: 1000 }
```

### T5: GEMINIGEN_API_KEY tidak diset

```bash
# Unset sementara di test env → submit → harusnya 503 "Video generation service unavailable. Credits refunded."
# Cek DB: status=failed, creditBalance kembali ke semula
```

### T6: Timeout self-heal

```bash
# Insert manual row di DB:
# INSERT INTO generated_media (id, status, external_job_id, user_id, prompt, created_at)
# VALUES (cuid(), 'processing', 'fake-uuid-xxx', '<userId>', 'stuck test', NOW() - INTERVAL '25 minutes');

# Jalankan cron manual → row ini harus: status=failed, credits refunded (kalau ada creditsCost)
```

### T7: Double-complete idempotency

```bash
# Panggil cron 2x berturut-turut saat ada job yang baru completed
# Kedua run: result sama, tidak ada error, tidak ada double-refund
```

---

## Checklist Eksekusi

```
[ ] 1. Buat src/lib/geminigen.ts
[ ] 2. Buat src/lib/video-rehost.ts
       - Cek signature uploadFile di storage.ts sebelum nulis
[ ] 3. Edit src/app/api/gen/video/route.ts
       - Hapus workerTask.create
       - Tambah GeminiGen submit + error handling + refund
[ ] 4. Buat src/app/api/cron/poll-geminigen/route.ts
[ ] 5. Edit src/app/api/webhooks/geminigen/route.ts
       - Hapus workerTask REHOST_VIDEO
       - Inline rehost + fallback ke cron
[ ] 6. Edit src/app/api/admin/generate/video/route.ts (kalau ada)
       - Samakan pattern
[ ] 7. npx tsc --noEmit → fix semua error yang disebabkan perubahan ini
       (error pre-existing dari model lain: CATAT tapi jangan fix)
[ ] 8. git add -p → commit per step:
       - "feat: geminigen.ts + video-rehost.ts client libs"
       - "refactor: gen/video — direct GeminiGen, no worker"
       - "feat: cron/poll-geminigen — auto poll + rehost + timeout"
       - "refactor: webhook/geminigen — inline rehost, no worker"
[ ] 9. git push origin main (JANGAN force-push)
[ ] 10. Tunggu Railway deploy (~2 mnt)
[ ] 11. Buat cron service di Railway (cron-poll-geminigen, */2 * * * *)
[ ] 12. Jalankan smoke tests T1–T7 secara berurutan
[ ] 13. Lapor: test mana pass, mana fail, apa error-nya
```

---

## Catatan Penting

- **Semua LLM** tetap via `src/lib/llm.ts` (DeepSeek). GeminiGen bukan LLM — ini API video gen, bukan subject aturan LLM.
- **Token/secret** (`GEMINIGEN_API_KEY`) JANGAN di-log, commit, atau response.
- **Migration tidak diperlukan** — schema tidak berubah. `workerTaskId` di GeneratedMedia sudah nullable, cukup biarkan null untuk job baru.
- **Worker tidak disentuh** — tetap jalan untuk Meta ops. Hanya job type GENERATE_VIDEO/REHOST_VIDEO yang tidak dibuat lagi dari HSL.
- **GeminiGen API shape**: kalau poll endpoint `/history/{uuid}` salah, lihat response error dan adjust. Alternatif: `/status/{uuid}` atau `/{uuid}`.
- **uploadFile signature**: cek `src/lib/storage.ts` dulu — bisa jadi `uploadFile(buffer, path, mimeType)` atau berbeda. JANGAN assume.
- **DEVIATION prefix** kalau ada yang menyimpang dari blueprint ini.
- **JANGAN claim done** tanpa jalankan T1 + T3 minimal.
