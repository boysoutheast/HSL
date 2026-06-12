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

  const account = await prisma.instagramAccount.findUnique({
    where: { id: params.id },
    include: {
      postingMonitor: {
        include: { hermesAgent: { select: { id: true, name: true } } },
      },
      performanceTrackers: { take: 10, orderBy: { createdAt: 'desc' } },
      photoReferences: { where: { status: 'active' }, orderBy: { createdAt: 'asc' } },
    },
  })

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  if (auth.role !== 'admin' && account.createdByUserId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ account })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    username?: string
    accountName?: string
    gender?: string
    status?: string
    purpose?: string
    notes?: string
    characterDescription?: string
    behavior?: string
    speakingStyle?: string
    expressionStyle?: string
    movementStyle?: string
    forbiddenRules?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (auth.role !== 'admin') {
    const existing = await prisma.instagramAccount.findFirst({
      where: { id: params.id, createdByUserId: auth.id },
    })
    if (!existing) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const account = await prisma.instagramAccount.update({
    where: { id: params.id },
    data: body,
  })

  return NextResponse.json({ account })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  if (auth.role !== 'admin') {
    const existing = await prisma.instagramAccount.findFirst({
      where: { id: params.id, createdByUserId: auth.id },
    })
    if (!existing) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const accountId = params.id

  // ── 1. Get all characters for this account ────────────────────────────────
  const characters = await prisma.character.findMany({
    where: { instagramAccountId: accountId },
    select: { id: true },
  })
  const characterIds = characters.map((c) => c.id)

  if (characterIds.length > 0) {
    // ── 2. Get topics for those characters ──────────────────────────────────
    const topics = await prisma.topic.findMany({
      where: { characterId: { in: characterIds } },
      select: { id: true },
    })
    const topicIds = topics.map((t) => t.id)

    if (topicIds.length > 0) {
      // ── 3. Get CEPs in those topics ────────────────────────────────────────
      const ceps = await prisma.cep.findMany({
        where: { topicId: { in: topicIds } },
        select: { id: true },
      })
      const cepIds = ceps.map((c) => c.id)

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
      await prisma.cep.deleteMany({ where: { topicId: { in: topicIds } } })
      await prisma.topic.deleteMany({ where: { characterId: { in: characterIds } } })
    }

    // ── 4. Null characterId in content logs ─────────────────────────────────
    await prisma.generatedContentLog.updateMany({
      where: { characterId: { in: characterIds } },
      data: { characterId: null },
    })

    // ── 5. Delete character photos (DB + files) ─────────────────────────────
    const charPhotos = await prisma.photoReference.findMany({
      where: { characterId: { in: characterIds } },
    })
    await prisma.photoReference.deleteMany({ where: { characterId: { in: characterIds } } })
    for (const photo of charPhotos) {
      await deletePhotoFile(photo.fileUrl)
      await deletePhotoFile(photo.thumbnailUrl)
    }

    // ── 6. Delete characters ────────────────────────────────────────────────
    await prisma.character.deleteMany({ where: { instagramAccountId: accountId } })
  }

  // ── 7. Delete performance snapshots + trackers ────────────────────────────
  const trackers = await prisma.performanceTracker.findMany({
    where: { instagramAccountId: accountId },
    select: { id: true },
  })
  const trackerIds = trackers.map((t) => t.id)
  if (trackerIds.length > 0) {
    await prisma.performanceSnapshot.deleteMany({
      where: { performanceTrackerId: { in: trackerIds } },
    })
    await prisma.performanceTracker.deleteMany({ where: { instagramAccountId: accountId } })
  }

  // ── 8. Delete content logs (instagramAccountId is non-nullable) ───────────
  await prisma.generatedContentLog.deleteMany({ where: { instagramAccountId: accountId } })

  // ── 9. Delete posting monitor ─────────────────────────────────────────────
  await prisma.postingMonitor.deleteMany({ where: { instagramAccountId: accountId } })

  // ── 10. Hard delete account ───────────────────────────────────────────────
  await prisma.instagramAccount.delete({ where: { id: accountId } })

  return NextResponse.json({ success: true })
}
