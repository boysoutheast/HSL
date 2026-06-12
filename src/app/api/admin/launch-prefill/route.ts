import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, ownerFilter } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const DEFAULT_AUDIENCE = { ageMin: 25, ageMax: 45, gender: 'all' as const }

function objectiveLabel(objective: string): string {
  if (objective === 'OUTCOME_SALES') return 'Sales'
  if (objective === 'OUTCOME_TRAFFIC') return 'Traffic'
  return 'Leads'
}

function dayStamp() {
  return new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }).replace('.', '')
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('productId')
  if (!productId) {
    return NextResponse.json({ error: 'productId is required' }, { status: 400 })
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, ...ownerFilter(auth) },
    include: {
      landingPages: {
        where: { isActive: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        take: 3,
      },
    },
  })

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const launches = await prisma.testLaunch.findMany({
    where: {
      ...ownerFilter(auth),
      status: { not: 'draft' },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      objective: true,
      metaAccountId: true,
      metaAdAccountId: true,
      pageId: true,
      igAccountId: true,
      pixelId: true,
      createdAt: true,
    },
    take: 50,
  })

  const launchCountByObjective = launches.reduce<Record<string, number>>((acc, launch) => {
    acc[launch.objective] = (acc[launch.objective] ?? 0) + 1
    return acc
  }, {})

  const objectiveEntries = Object.entries(launchCountByObjective) as Array<[string, number]>
  const objective = objectiveEntries.sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'OUTCOME_LEADS'
  const lastUsed = launches[0] ?? null
  const landingPage = product.landingPages[0] ?? null

  const media = await prisma.mediaAsset.findMany({
    where: {
      ...ownerFilter(auth),
      productId,
      status: 'READY',
    },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: {
      id: true,
      fileUrl: true,
      thumbnailUrl: true,
      type: true,
    },
  })

  const linkedAccount = await prisma.instagramAccount.findFirst({
    where: {
      ...ownerFilter(auth),
      OR: [
        { contentLogs: { some: { productId } } },
        { mediaAssets: { some: { productId } } },
      ],
    },
    select: {
      id: true,
      username: true,
      gender: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const audience = linkedAccount
    ? {
        ageMin: DEFAULT_AUDIENCE.ageMin,
        ageMax: DEFAULT_AUDIENCE.ageMax,
        gender: (linkedAccount.gender as 'all' | 'male' | 'female') ?? DEFAULT_AUDIENCE.gender,
      }
    : DEFAULT_AUDIENCE

  const sources = {
    campaignName: 'auto',
    objective: launchCountByObjective[objective] ? 'history' : 'default',
    metaAccountId: lastUsed?.metaAccountId ? 'history' : 'default',
    metaAdAccountId: lastUsed?.metaAdAccountId ? 'history' : 'default',
    pageId: lastUsed?.pageId ? 'history' : 'default',
    igAccountId: lastUsed?.igAccountId ? 'history' : 'default',
    pixelId: lastUsed?.pixelId ? 'history' : 'default',
    linkUrl: landingPage?.url ? 'landing_page' : 'default',
    media: media.length > 0 ? 'media_ready' : 'default',
    audience: linkedAccount ? 'account_persona' : 'default',
  }

  return NextResponse.json({
    prefill: {
      campaignName: `${product.name} - ${objectiveLabel(objective)} - ${dayStamp()}`,
      objective,
      metaAccountId: lastUsed?.metaAccountId ?? null,
      metaAdAccountId: lastUsed?.metaAdAccountId ?? null,
      pageId: lastUsed?.pageId ?? null,
      igAccountId: lastUsed?.igAccountId ?? null,
      pixelId: lastUsed?.pixelId ?? null,
      linkUrl: landingPage?.url ?? product.productUrl ?? '',
      media,
      audience,
      sources,
    },
  })
}
