import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { uploadFile } from '@/lib/storage'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024 // 200 MB

// POST /api/admin/media-assets/upload — upload file beneran ke Volume + create asset
// FormData: file (wajib), label (opsional)
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })

  const isImage = IMAGE_TYPES.includes(file.type)
  const isVideo = VIDEO_TYPES.includes(file.type)
  if (!isImage && !isVideo) {
    return NextResponse.json(
      { error: 'Format tidak didukung. Image: JPEG/PNG/WebP/GIF. Video: MP4/MOV/WebM.' },
      { status: 400 }
    )
  }

  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: `File terlalu besar. Max ${isVideo ? '200MB (video)' : '10MB (image)'}.` },
      { status: 400 }
    )
  }

  const label = ((formData.get('label') as string) || file.name.replace(/\.[^.]+$/, '')).slice(0, 200)

  const ext = (file.name.split('.').pop() ?? (isVideo ? 'mp4' : 'jpg')).toLowerCase()
  const key = `media/${uuidv4()}.${ext}`

  let buffer: Buffer
  let checksum: string
  let publicUrl: string
  try {
    buffer = Buffer.from(await file.arrayBuffer())
    checksum = crypto.createHash('sha256').update(buffer).digest('hex')
    publicUrl = await uploadFile(key, buffer, file.type)
  } catch (err) {
    console.error('[upload] storage error:', err)
    return NextResponse.json({ error: 'Gagal menyimpan file ke storage' }, { status: 500 })
  }

  let asset
  try {
    asset = await prisma.mediaAsset.create({
      data: {
        userId: auth.id,
        label,
        type: isVideo ? 'VIDEO' : 'IMAGE',
        source: 'USER_UPLOAD',
        storageProvider: 'railway_volume',
        storagePath: key,
        publicUrl,
        fileUrl: publicUrl,
        mimeType: file.type,
        fileSizeBytes: file.size,
        checksum,
        status: 'READY',
        moderationStatus: 'APPROVED',
      },
    })
  } catch (err) {
    console.error('[upload] prisma error:', err)
    return NextResponse.json({ error: 'Gagal menyimpan metadata asset' }, { status: 500 })
  }

  return NextResponse.json({ asset }, { status: 201 })
}
