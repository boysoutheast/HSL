// Download video from GeminiGen CDN → rehost to Railway Volume
//
// uploadFile signature (from src/lib/storage.ts):
//   uploadFile(key: string, body: Buffer, _contentType: string): Promise<string>
//   key = storage path, e.g. "videos/jobId.mp4"

import { uploadFile } from '@/lib/storage'

// Download video from CDN URL, upload to permanent Railway Volume.
// Returns the public serving URL (via /api/photos/serve/...).
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

  // Detect extension from URL or default to mp4
  const ext = sourceUrl.split('?')[0].split('.').pop()?.toLowerCase() ?? 'mp4'
  const safeExt = /^(mp4|webm|mov)$/.test(ext) ? ext : 'mp4'

  // uploadFile(key, body, contentType) — key is path, body is Buffer
  const key = `videos/${jobId}.${safeExt}`
  const contentType = `video/${safeExt}`
  return await uploadFile(key, buffer, contentType)
}

// Download thumbnail from CDN URL if available.
// Returns public URL or null on any error.
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
    const key = `thumbs/${jobId}.${safeExt}`
    return await uploadFile(key, buf, `image/${safeExt}`)
  } catch {
    return null
  }
}
