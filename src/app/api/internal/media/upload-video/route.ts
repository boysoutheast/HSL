import { NextRequest, NextResponse } from 'next/server'
import { uploadFile } from '@/lib/storage'
import { v4 as uuidv4 } from 'uuid'
import { validateApiKey, unauthorizedResponse } from '../../_lib/api-key-auth'

export const runtime = 'nodejs'

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'application/octet-stream', // CDN may serve video as octet-stream
]

const ALLOWED_VIDEO_EXTENSIONS = new Set([
  'mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v', '3gp',
])

// Magic byte signatures for video formats
const MAGIC_BYTES: [number[], string][] = [
  [[0x00, 0x00, 0x00], 'mp4'],    // ftyp boxes — weak but common prefix
  [[0x66, 0x74, 0x79, 0x70], 'mp4'],  // 'ftyp' at offset 4
  [[0x1a, 0x45, 0xdf, 0xa3], 'webm'], // Matroska/WebM
  [[0x52, 0x49, 0x46, 0x46], 'avi'],  // RIFF...AVI
  [[0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70], 'mp4'], // MOV/mp4
  [[0x46, 0x4c, 0x56, 0x01], 'flv'],  // FLV
  [[0x30, 0x26, 0xb2, 0x75], 'wmv'],  // ASF/WMV
]

function detectVideoFormat(buffer: Buffer): string | null {
  if (buffer.length < 4) return null
  for (const [bytes, ext] of MAGIC_BYTES) {
    if (buffer.length >= bytes.length) {
      let match = true
      for (let i = 0; i < bytes.length; i++) {
        if (buffer[i] !== bytes[i]) { match = false; break }
      }
      if (match) return ext
    }
  }
  // QuickTime 'moov' at any offset (look in first 4KB)
  const quicktimeSearch = Buffer.from([0x6d, 0x6f, 0x6f, 0x76]) // 'moov'
  const searchLimit = Math.min(buffer.length, 4096)
  for (let i = 0; i < searchLimit - 4; i++) {
    if (
      buffer[i] === 0x6d && buffer[i + 1] === 0x6f &&
      buffer[i + 2] === 0x6f && buffer[i + 3] === 0x76
    ) {
      return 'mov'
    }
  }
  return null
}

function resolveContentType(ext: string): string {
  const map: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    flv: 'video/x-flv',
    wmv: 'video/x-ms-wmv',
    m4v: 'video/mp4',
    '3gp': 'video/3gpp',
  }
  return map[ext] || 'video/mp4'
}

/**
 * POST /api/internal/media/upload-video
 * Upload a video file to /data/photos/generated/.
 * Accepts multipart/form-data with:
 *   - file (required): video binary
 *   - label (optional): human label
 *
 * Validation: extension-first, magic bytes as fallback.
 * Content-type may be application/octet-stream (CDNs serve this).
 *
 * Returns: { key, fileUrl }
 */
export async function POST(req: NextRequest) {
  if (!validateApiKey(req)) {
    return unauthorizedResponse()
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }

  if (file.size > 100 * 1024 * 1024) {
    return NextResponse.json({ error: 'File exceeds 100MB limit' }, { status: 400 })
  }

  const rawExt = file.name.split('.').pop() ?? 'mp4'
  const filenameExt = /^[a-z0-9]{1,5}$/i.test(rawExt) ? rawExt.toLowerCase() : null

  // 1. Accept by extension — primary check
  if (filenameExt && ALLOWED_VIDEO_EXTENSIONS.has(filenameExt)) {
    // Valid extension — accept regardless of content-type
    const key = `photos/generated/${uuidv4()}.${filenameExt}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const contentType = resolveContentType(filenameExt)
    const fileUrl = await uploadFile(key, buffer, contentType)
    return NextResponse.json({ key, fileUrl }, { status: 201 })
  }

  // 2. Accept by content-type — fallback
  if (ALLOWED_VIDEO_TYPES.includes(file.type)) {
    const ext = filenameExt || 'mp4'
    const key = `photos/generated/${uuidv4()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const contentType = resolveContentType(ext)
    const fileUrl = await uploadFile(key, buffer, contentType)
    return NextResponse.json({ key, fileUrl }, { status: 201 })
  }

  // 3. Magic bytes as last resort
  const buffer = Buffer.from(await file.arrayBuffer())
  const magicExt = detectVideoFormat(buffer)
  if (magicExt && ALLOWED_VIDEO_EXTENSIONS.has(magicExt)) {
    const key = `photos/generated/${uuidv4()}.${magicExt}`
    const contentType = resolveContentType(magicExt)
    const fileUrl = await uploadFile(key, buffer, contentType)
    return NextResponse.json({ key, fileUrl }, { status: 201 })
  }

  return NextResponse.json(
    {
      error: `Unsupported video: type=${file.type}, ext=.${filenameExt || 'none'}, magic=${magicExt || 'none'}. Allowed extensions: ${[...ALLOWED_VIDEO_EXTENSIONS].join(', ')}`,
    },
    { status: 400 },
  )
}
