import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateHermesApiKey, extractBearerToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) {
    return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
  }

  const agent = await validateHermesApiKey(token)
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const characterId = searchParams.get('characterId')
  const productId = searchParams.get('productId')
  const topicId = searchParams.get('topicId')
  const category = searchParams.get('category')

  const assignments = await prisma.assignment.findMany({
    where: { hermesAgentId: agent.id, status: 'active' },
  })

  const accountIds = assignments
    .filter(a => a.assignableType === 'instagram_account')
    .map(a => a.assignableId)

  const characterIds = assignments
    .filter(a => a.assignableType === 'character')
    .map(a => a.assignableId)

  const topicIds = assignments
    .filter(a => a.assignableType === 'topic')
    .map(a => a.assignableId)

  const productIds = assignments
    .filter(a => a.assignableType === 'product')
    .map(a => a.assignableId)

  // Resolve character assignments → parent account IDs (backward compat),
  // mirror logika /api/hermes/library agar foto yang di-tag ke instagramAccount
  // (model persona-embedded) ikut kebawa.
  let charParentAccountIds: string[] = []
  if (characterIds.length > 0) {
    const charAccounts = await prisma.character.findMany({
      where: { id: { in: characterIds } },
      select: { instagramAccountId: true },
    })
    charParentAccountIds = charAccounts.map(c => c.instagramAccountId)
  }
  const allAccountIds = [...new Set([...accountIds, ...charParentAccountIds])]

  const photos = await prisma.photoReference.findMany({
    where: {
      status: 'active',
      OR: [
        { instagramAccountId: { in: allAccountIds } },
        { characterId: { in: characterIds } },
        { topicId: { in: topicIds } },
        { productId: { in: productIds } },
      ],
      ...(characterId ? { characterId } : {}),
      ...(productId ? { productId } : {}),
      ...(topicId ? { topicId } : {}),
      ...(category ? { category } : {}),
    },
    include: {
      character: { select: { id: true, name: true } },
      topic: { select: { id: true, name: true } },
      product: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Ensure all photo URLs are absolute
  const base = (process.env.NEXT_PUBLIC_BASE_URL ?? '').replace(/\/$/, '')
  const absolutePhotos = photos.map(p => ({
    ...p,
    fileUrl: p.fileUrl.startsWith('http') ? p.fileUrl : `${base}${p.fileUrl}`,
    thumbnailUrl: p.thumbnailUrl
      ? p.thumbnailUrl.startsWith('http')
        ? p.thumbnailUrl
        : `${base}${p.thumbnailUrl}`
      : null,
  }))

  return NextResponse.json({
    photos: absolutePhotos,
    total: absolutePhotos.length,
    activeCount: absolutePhotos.filter(p => p.status === 'active').length,
  })
}
