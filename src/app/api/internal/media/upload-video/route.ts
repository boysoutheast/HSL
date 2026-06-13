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
]

/**
 * POST /api/internal/media/upload-video
 * Upload a video file to /data/photos/generated/.
 * Accepts multipart/form-data with:
 *   - file (required): video binary
 *   - label (optional): human label
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

  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return NextResponse.json(
      {
        error: `Unsupported video type: ${file.type}. Allowed: ${ALLOWED_VIDEO_TYPES.join(', ')}`,
      },
      { status: 400 },
    )
  }

  if (file.size > 100 * 1024 * 1024) {
    return NextResponse.json({ error: 'File exceeds 100MB limit' }, { status: 400 })
  }

  const rawExt = file.name.split('.').pop() ?? 'mp4'
  // sanitize: ext harus alphanumeric pendek, kalau aneh → fallback mp4
  // (cegah path injection via filename, mis. "x.mp4/../foo")
  const ext = /^[a-z0-9]{1,5}$/i.test(rawExt) ? rawExt.toLowerCase() : 'mp4'
  const key = `photos/generated/${uuidv4()}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const fileUrl = await uploadFile(key, buffer, file.type)

  return NextResponse.json(
    { key, fileUrl },
    { status: 201 },
  )
}
