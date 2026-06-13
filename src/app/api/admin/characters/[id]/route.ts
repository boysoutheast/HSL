import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { unlink } from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'

const STORAGE_ROOT = process.env.STORAGE_ROOT ?? '/data/photos'

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
  try { await unlink(path.join(STORAGE_ROOT, key)) } catch { /* ignore */ }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const character = await prisma.character.findFirst({
    where: {
      id: params.id,
      ...(auth.role === 'admin' ? {} : { instagramAccount: { createdByUserId: auth.id } }),
    },
    include: {
      instagramAccount: true,
      photoReferences: { where: { status: 'active' } },
      topics: { where: { status: 'active' } },
    },
  })

  if (!character) {
    return NextResponse.json({ error: 'Character not found' }, { status: 404 })
  }

  return NextResponse.json({ character })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    name?: string
    description?: string
    behavior?: string
    speakingStyle?: string
    expressionStyle?: string
    movementStyle?: string
    forbiddenRules?: string
    status?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Ownership check
  if (auth.role !== 'admin') {
    const owned = await prisma.character.findFirst({
      where: { id: params.id, instagramAccount: { createdByUserId: auth.id } },
      select: { id: true },
    })
    if (!owned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const character = await prisma.character.update({
    where: { id: params.id },
    data: body,
  })

  return NextResponse.json({ character })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  // Ownership check
  if (auth.role !== 'admin') {
    const owned = await prisma.character.findFirst({
      where: { id: params.id, instagramAccount: { createdByUserId: auth.id } },
      select: { id: true },
    })
    if (!owned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const character = await prisma.character.findUnique({ where: { id: params.id } })
  if (!character) {
    return NextResponse.json({ error: 'Character not found' }, { status: 404 })
  }

  // 1. Get all topics for this character
  const topics = await prisma.topic.findMany({
    where: { characterId: params.id },
    select: { id: true },
  })
  const topicIds = topics.map((t) => t.id)

  if (topicIds.length > 0) {
    // 2. Get all CEPs in those topics
    const ceps = await prisma.cep.findMany({
      where: { topicId: { in: topicIds } },
      select: { id: true },
    })
    const cepIds = ceps.map((c) => c.id)

    // 3. Null out cepId + topicId in content logs
    if (cepIds.length > 0) {
      await prisma.generatedContentLog.updateMany({
        where: { cepId: { in: cepIds } },
        data: { cepId: null },
      })
    }
    await prisma.generatedContentLog.updateMany({
      where: { topicId: { in: topicIds } },
      data: { topicId: null },
    })

    // 4. Hard delete CEPs + topics
    await prisma.cep.deleteMany({ where: { topicId: { in: topicIds } } })
    await prisma.topic.deleteMany({ where: { characterId: params.id } })
  }

  // 5. Null out characterId in content logs
  await prisma.generatedContentLog.updateMany({
    where: { characterId: params.id },
    data: { characterId: null },
  })

  // 6. Delete character photos (DB + files)
  const photos = await prisma.photoReference.findMany({ where: { characterId: params.id } })
  await prisma.photoReference.deleteMany({ where: { characterId: params.id } })
  for (const photo of photos) {
    await deletePhotoFile(photo.fileUrl)
    await deletePhotoFile(photo.thumbnailUrl)
  }

  // 7. Hard delete character
  await prisma.character.delete({ where: { id: params.id } })

  return NextResponse.json({ success: true })
}
