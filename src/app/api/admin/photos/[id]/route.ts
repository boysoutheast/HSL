import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { unlink } from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'

const STORAGE_ROOT = process.env.STORAGE_ROOT ?? '/data/photos'

/** Extract the storage key from a /api/photos/serve/<key> URL. */
function fileKeyFromUrl(url: string | null): string | null {
  if (!url) return null
  const marker = '/api/photos/serve/'
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return url.slice(idx + marker.length)
}

async function deletePhotoFile(fileUrl: string | null) {
  const key = fileKeyFromUrl(fileUrl)
  if (!key) return
  try {
    await unlink(path.join(STORAGE_ROOT, key))
  } catch {
    // File may already be gone — ignore
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    label?: string
    category?: string
    status?: string
    notes?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const photo = await prisma.photoReference.update({
    where: { id: params.id },
    data: {
      ...(body.label !== undefined ? { label: body.label } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    },
  })

  return NextResponse.json({ photo })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const photo = await prisma.photoReference.findUnique({ where: { id: params.id } })
  if (!photo) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
  }

  // Null out referenceImageId in any content logs referencing this photo
  await prisma.generatedContentLog.updateMany({
    where: { referenceImageId: params.id },
    data: { referenceImageId: null },
  })

  // Hard delete DB record
  await prisma.photoReference.delete({ where: { id: params.id } })

  // Delete actual files from Railway Volume
  await deletePhotoFile(photo.fileUrl)
  await deletePhotoFile(photo.thumbnailUrl)

  return NextResponse.json({ success: true })
}
