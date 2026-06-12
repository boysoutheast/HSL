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

  const cepIds = assignments
    .filter(a => a.assignableType === 'cep')
    .map(a => a.assignableId)

  const productIds = assignments
    .filter(a => a.assignableType === 'product')
    .map(a => a.assignableId)

  const base = (process.env.NEXT_PUBLIC_BASE_URL ?? '').replace(/\/$/, '')

  function toAbsoluteUrl(url: string | null): string | null {
    if (!url) return null
    return url.startsWith('http') ? url : `${base}${url}`
  }

  // Resolve character assignments → parent account IDs (backward compat)
  let charParentAccountIds: string[] = []
  if (characterIds.length > 0) {
    const charAccounts = await prisma.character.findMany({
      where: { id: { in: characterIds } },
      select: { instagramAccountId: true },
    })
    charParentAccountIds = charAccounts.map(c => c.instagramAccountId)
  }
  const allAccountIds = [...new Set([...accountIds, ...charParentAccountIds])]

  // Resolve character assignments → their active topics (for CEP lookup)
  let characterTopicIds: string[] = []
  if (characterIds.length > 0) {
    const charTopics = await prisma.topic.findMany({
      where: { characterId: { in: characterIds }, status: 'active' },
      select: { id: true },
    })
    characterTopicIds = charTopics.map(t => t.id)
  }
  const allTopicIds = [...new Set([...topicIds, ...characterTopicIds])]

  // Build CEP where clause: direct assignments + by productId + by topicId
  const cepWhere = {
    status: 'active',
    OR: [
      ...(cepIds.length > 0       ? [{ id: { in: cepIds } }]           : []),
      ...(productIds.length > 0   ? [{ productId: { in: productIds } }] : []),
      ...(allTopicIds.length > 0  ? [{ topicId: { in: allTopicIds } }]  : []),
    ],
  }

  const [accounts, topics, ceps, products] = await Promise.all([
    prisma.instagramAccount.findMany({
      where: { id: { in: allAccountIds }, status: 'active' },
      include: {
        photoReferences: { where: { status: 'active' }, orderBy: { createdAt: 'asc' } },
      },
    }),
    prisma.topic.findMany({
      where: { id: { in: topicIds }, status: 'active' },
      include: {
        photoReferences: { where: { status: 'active' } },
      },
    }),
    cepWhere.OR.length > 0
      ? prisma.cep.findMany({
          where: cepWhere,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, cepText: true, painPoint: true, angle: true,
            source: true, topicId: true, productId: true,
          },
        })
      : Promise.resolve([]),
    prisma.product.findMany({
      where: { id: { in: productIds }, status: 'active' },
      include: {
        photoReferences: { where: { status: 'active' } },
        landingPages: { where: { isActive: true }, orderBy: { isDefault: 'desc' } },
      },
    }),
  ])

  // Media assets scoped to assigned entities (photo + video)
  const mediaAssetIds = assignments
    .filter(a => a.assignableType === 'media_asset')
    .map(a => a.assignableId)

  const mediaAssetWhere = {
    status: 'READY' as const,
    OR: [
      ...(mediaAssetIds.length > 0  ? [{ id: { in: mediaAssetIds } }]              : []),
      ...(characterIds.length > 0   ? [{ characterId: { in: characterIds } }]       : []),
      ...(productIds.length > 0     ? [{ productId: { in: productIds } }]            : []),
      ...(accountIds.length > 0     ? [{ instagramAccountId: { in: accountIds } }]  : []),
    ],
  }

  const mediaAssets = mediaAssetWhere.OR.length > 0
    ? await prisma.mediaAsset.findMany({
        where: mediaAssetWhere,
        select: {
          id: true, type: true, fileUrl: true, thumbnailUrl: true,
          label: true, category: true, tags: true,
          width: true, height: true, duration: true, aspectRatio: true,
          characterId: true, productId: true, instagramAccountId: true, topicId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
    : []

  const absoluteify = <T extends { photoReferences?: Array<{ fileUrl: string; thumbnailUrl: string | null; [key: string]: unknown }> }>(items: T[]): T[] =>
    items.map(item => ({
      ...item,
      photoReferences: item.photoReferences?.map(p => ({
        ...p,
        fileUrl: toAbsoluteUrl(p.fileUrl) ?? p.fileUrl,
        thumbnailUrl: toAbsoluteUrl(p.thumbnailUrl),
      })),
    }))

  const absoluteMediaAssets = mediaAssets.map(a => ({
    ...a,
    fileUrl: toAbsoluteUrl(a.fileUrl ?? '') ?? '',
    thumbnailUrl: toAbsoluteUrl(a.thumbnailUrl),
  }))

  const accountsWithPhotos = absoluteify(accounts).map(acc => ({
    ...acc,
    photoCount: acc.photoReferences?.length ?? 0,
  }))

  return NextResponse.json({
    agent: { id: agent.id, name: agent.name },
    library: {
      instagramAccounts: accountsWithPhotos,
      topics: absoluteify(topics),
      ceps,
      products: absoluteify(products),
      mediaAssets: absoluteMediaAssets,
    },
  })
}
