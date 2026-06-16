// Download video from GeminiGen CDN → rehost to Railway Volume
//
// uploadFile signature (from src/lib/storage.ts):
//   uploadFile(key: string, body: Buffer, _contentType: string): Promise<string>
//   key = storage path, e.g. "videos/jobId.mp4"

import { uploadFile } from '@/lib/storage'

function assertSafePublicUrl(raw: string): URL {
  let u: URL
  try { u = new URL(raw) } catch { throw new Error('Invalid URL') }
  if (u.protocol !== 'https:') throw new Error('Only https allowed')
  const host = u.hostname.toLowerCase()
  // Block private / loopback / link-local / metadata
  const blocked = [
    /^localhost$/, /^127\./, /^10\./, /^192\.168\./,
    /^169\.254\./, /^::1$/, /^0\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  ]
  if (blocked.some((re) => re.test(host))) throw new Error('Blocked host')
  // Allowlist domain CDN GeminiGen (terverifikasi dari rawWebhookJson prod):
  // media/thumbnail dilayani dari iDrive e2 (idrivee2.com / e2-3.dev) + cdn.geminigen.ai
  const allowed = ['.geminigen.ai', '.idrivee2.com', '.e2-3.dev']
  if (!allowed.some((d) => host === d.replace(/^\./, '') || host.endsWith(d))) {
    throw new Error(`Host not allowlisted: ${host}`)
  }
  return u
}

// Download video from CDN URL, upload to permanent Railway Volume.
// Returns the public serving URL (via /api/photos/serve/...).
export async function rehostVideo(
  sourceUrl: string,
  jobId: string,
): Promise<string> {
  assertSafePublicUrl(sourceUrl)
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
    assertSafePublicUrl(sourceUrl)
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
