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
        select: { accountName: true, defaultAdAccountId: true },
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
    metaAccountId: string
    productId?: string
    name: string
    objective: string
    dailyBudget: number
    targetingJson?: string
    launchMode: string
    sourceAdsetId?: string
    notes?: string
    creatives?: Array<{
      creativeUrl?: string
      captionText?: string
      hookText?: string
      headline?: string
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

  const testLaunch = await prisma.testLaunch.create({
    data: {
      userId: auth.id,
      metaAccountId: body.metaAccountId,
      productId: body.productId,
      name: body.name,
      objective: body.objective,
      dailyBudget: body.dailyBudget,
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
        select: { accountName: true, defaultAdAccountId: true },
      },
    },
  })

  return NextResponse.json({ testLaunch }, { status: 201 })
}
