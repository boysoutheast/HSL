// GeminiGen video generation client — direct API wrapper
// All access to GeminiGen goes through this file.
//
// API shape (verified from GeminiGen live 2026-06-17):
//   Submit: POST /video-gen/grok
//     Fields: prompt, model=grok-video, aspect_ratio, duration, mode=custom
//     File:   files = <binary image>   ← multipart, field name "files"
//   Poll:   GET /history/{uuid} → { id, uuid, status, status_desc, status_percentage, ... }
//   status:  1=processing, 2=completed, 3=failed

export interface GeminiGenSubmitParams {
  prompt: string
  aspectRatio: string      // 'portrait' | 'landscape' | 'square'
  durationSeconds: number  // 6 | 10
  imageUrls?: string[]     // optional — fetch from URL, send as file
  imageBuffer?: Buffer     // optional — raw bytes from direct upload (takes priority)
  imageFilename?: string   // filename hint for imageBuffer (default: reference.jpg)
}

export interface GeminiGenJobStatus {
  uuid: string
  status: number  // 1=processing, 2=completed, 3=failed
  statusDesc: string
  statusPercentage: number  // 0-100
  errorCode: string
  errorMessage: string
  videoUrl: string | null
  thumbnailUrl: string | null
}

const BASE = 'https://api.geminigen.ai/uapi/v1'

function apiKey(): string {
  const k = process.env.GEMINIGEN_API_KEY
  if (!k) throw new Error('GEMINIGEN_API_KEY not set')
  return k
}

// Submit a video generation job to GeminiGen.
// Returns the external job uuid.
export async function submitVideoJob(params: GeminiGenSubmitParams): Promise<string> {
  const form = new FormData()
  form.append('prompt', params.prompt)
  form.append('model', 'grok-video')
  form.append('aspect_ratio', params.aspectRatio)
  form.append('duration', String(params.durationSeconds))
  form.append('mode', 'custom')

  // Image reference — direct buffer takes priority over URL fetch
  if (params.imageBuffer && params.imageBuffer.length > 0) {
    const blob = new Blob([new Uint8Array(params.imageBuffer)], { type: 'image/jpeg' })
    form.append('files', blob, params.imageFilename ?? 'reference.jpg')
  } else if (params.imageUrls && params.imageUrls.length > 0) {
    const imgRes = await fetch(params.imageUrls[0])
    if (imgRes.ok) {
      const blob = await imgRes.blob()
      form.append('files', blob, 'reference.jpg')
    }
  }

  const res = await fetch(`${BASE}/video-gen/grok`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey() },
    body: form,
    signal: AbortSignal.timeout(30_000),
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

// Poll job status from GeminiGen.
// Endpoint yang BENAR: GET /history/{uuid} (BUKAN /video-gen/history/{uuid} yang selalu 404).
// Video URL ada di generated_video[].video_url, BUKAN media_url (selalu null di response /history).
// Verified live dari API prod 2026-06-17.
export async function pollJobStatus(uuid: string): Promise<GeminiGenJobStatus> {
  const res = await fetch(`${BASE}/history/${uuid}`, {
    headers: { 'x-api-key': apiKey() },
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    throw new Error(`GeminiGen poll failed ${res.status} for uuid ${uuid}`)
  }

  const data = await res.json()
  const d = data?.data ?? data

  // Extract video URL from generated_video array (verified live)
  let videoUrl: string | null = null
  if (Array.isArray(d.generated_video) && d.generated_video.length > 0) {
    for (const vid of d.generated_video) {
      if (vid.video_url && vid.status === 2) {
        videoUrl = vid.video_url
        break
      }
    }
  }
  // Fallback to legacy media_url if present (webhook path still uses it)
  if (!videoUrl && d.media_url) {
    videoUrl = d.media_url
  }

  return {
    uuid: d.uuid ?? uuid,
    status: typeof d.status === 'number' ? d.status : 1,
    statusDesc: d.status_desc ?? '',
    statusPercentage: typeof d.status_percentage === 'number' ? d.status_percentage : 0,
    errorCode: d.error_code ?? '',
    errorMessage: d.error_message ?? '',
    videoUrl,
    thumbnailUrl: d.thumbnail_url ?? d.thumbnailUrl ?? null,
  }
}
