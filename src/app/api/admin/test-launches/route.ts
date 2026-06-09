import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, ownerFilter } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const testLaunches = await prisma.testLaunch.findMany({
    where: {
      ...ownerFilter(auth, 'userId'),
      ...(status ? { status } : {}),
    },
    include: {
      creatives: true,
      approvalRequest: true,
      metaAccount: {
        select: { accountName: true, defaultAdAccountId: true, status: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ testLaunches })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    metaBusinessId?: string
    metaAdAccountId?: string
    metaAccountId: string
    productId?: string
    name: string
    objective: string
    dailyBudget: number
    currency?: string
    pageId?: string
    igAccountId?: string
    pixelId?: string
    placementMode?: string
    placementsJson?: string
    audienceJson?: string
    destinationUrl?: string
    targetingJson?: string
    launchMode: string
    sourceAdsetId?: string
    notes?: string
    creatives?: Array<{
      creativeUrl?: string
      captionText?: string
      hookText?: string
      headline?: string
      primaryText?: string
      adHeadline?: string
      callToAction?: string
      sortOrder?: number
    }>
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.metaAccountId || !body.name || !body.objective || body.dailyBudget === undefined || !body.launchMode) {
    return NextResponse.json({ error: 'metaAccountId, name, objective, dailyBudget, and launchMode are required' }, { status: 400 })
  }

  if (body.dailyBudget <= 0) {
    return NextResponse.json({ error: 'dailyBudget must be greater than 0' }, { status: 400 })
  }

  const testLaunch = await prisma.testLaunch.create({
    data: {
      userId: auth.id,
      metaAccountId: body.metaAccountId,
      metaBusinessId: body.metaBusinessId,
      metaAdAccountId: body.metaAdAccountId,
      productId: body.productId,
      name: body.name,
      objective: body.objective,
      dailyBudget: body.dailyBudget,
      currency: body.currency ?? 'IDR',
      pageId: body.pageId,
      igAccountId: body.igAccountId,
      pixelId: body.pixelId,
      placementMode: body.placementMode ?? 'automatic',
      placementsJson: body.placementsJson,
      audienceJson: body.audienceJson,
      destinationUrl: body.destinationUrl,
      targetingJson: body.targetingJson,
      launchMode: body.launchMode,
      sourceAdsetId: body.sourceAdsetId,
      notes: body.notes,
      ...(body.creatives && body.creatives.length > 0
        ? {
            creatives: {
              create: body.creatives.map((c) => ({
                creativeUrl: c.creativeUrl,
                captionText: c.captionText,
                hookText: c.hookText,
                headline: c.headline,
                primaryText: c.primaryText,
                adHeadline: c.adHeadline,
                callToAction: c.callToAction,
                sortOrder: c.sortOrder ?? 0,
              })),
            },
          }
        : {}),
    },
    include: {
      creatives: true,
      metaAccount: {
        select: { accountName: true, defaultAdAccountId: true, status: true },
      },
    },
  })

  return NextResponse.json({ testLaunch }, { status: 201 })
}
