// GeminiGen video generation client — direct API wrapper
// All access to GeminiGen goes through this file.
//
// API shape (confirmed from agent flow):
//   Submit: POST /video-gen/grok
//     Fields: prompt, model=grok-video, aspect_ratio, duration, mode=custom
//     File:   files = <binary image>   ← multipart, field name "files"
//   Poll:   GET /video-gen/history/{uuid} → { data: { uuid, status, media_url, thumbnail_url } }
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
  mediaUrl: string | null
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
export async function pollJobStatus(uuid: string): Promise<GeminiGenJobStatus> {
  const res = await fetch(`${BASE}/video-gen/history/${uuid}`, {
    headers: { 'x-api-key': apiKey() },
  })

  if (!res.ok) {
    throw new Error(`GeminiGen poll failed ${res.status} for uuid ${uuid}`)
  }

  const data = await res.json()
  const d = data?.data ?? data
  return {
    uuid: d.uuid ?? uuid,
    status: typeof d.status === 'number' ? d.status : 1,
    mediaUrl: d.media_url ?? d.mediaUrl ?? null,
    thumbnailUrl: d.thumbnail_url ?? d.thumbnailUrl ?? null,
  }
}
