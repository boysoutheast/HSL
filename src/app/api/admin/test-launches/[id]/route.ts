import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const testLaunch = await prisma.testLaunch.findUnique({
    where: { id: params.id },
    include: {
      creatives: true,
      adsets: {
        include: {
          creatives: {
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
      approvalRequest: {
        include: {
          requestedBy: { select: { id: true, name: true, email: true } },
          reviewedBy: { select: { id: true, name: true, email: true } },
        },
      },
      metaAccount: {
        select: {
          accountName: true,
          status: true,
          appId: true,
          metaUserName: true,
          defaultAdAccountId: true,
        },
      },
      workerTasks: true,
    },
  })

  if (!testLaunch) {
    return NextResponse.json({ error: 'TestLaunch not found' }, { status: 404 })
  }

  // Ownership check: non-admin can only see their own launches
  if (testLaunch.userId !== auth.id && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const metaAdAccount = testLaunch.metaAdAccountId
    ? await prisma.metaAdAccount.findUnique({
        where: { id: testLaunch.metaAdAccountId },
        select: {
          id: true,
          adAccountId: true,
          adAccountName: true,
          currency: true,
          accountStatus: true,
        },
      })
    : null

  return NextResponse.json({ testLaunch: { ...testLaunch, metaAdAccount } })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const existing = await prisma.testLaunch.findUnique({
    where: { id: params.id },
    select: { userId: true, status: true },
  })

  if (!existing) {
    return NextResponse.json({ error: 'TestLaunch not found' }, { status: 404 })
  }

  if (existing.userId !== auth.id && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (existing.status !== 'draft') {
    return NextResponse.json({ error: 'Can only update drafts' }, { status: 400 })
  }

  let body: {
    metaBusinessId?: string
    metaAdAccountId?: string
    metaAccountId?: string
    productId?: string
    name?: string
    objective?: string
    dailyBudget?: number
    budgetMode?: string
    currency?: string
    pageId?: string
    igAccountId?: string
    pixelId?: string
    placementMode?: string
    placementsJson?: string
    audienceJson?: string
    destinationUrl?: string
    targetingJson?: string
    launchMode?: string
    sourceAdsetId?: string
    notes?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Build targetingJson from audienceJson if audienceJson is provided
  if (body.audienceJson && !body.targetingJson) {
    try {
      const audience = JSON.parse(body.audienceJson)
      const targeting: Record<string, unknown> = {
        age_min: audience.ageMin ?? 18,
        age_max: audience.ageMax ?? 65,
      }
      if (audience.gender && audience.gender !== 'all') {
        targeting.gender = audience.gender
      }
      if (audience.locations && audience.locations.length > 0) {
        targeting.geo_locations = { locations: audience.locations }
      }
      if (audience.interests && audience.interests.length > 0) {
        targeting.interests = audience.interests
      }
      body.targetingJson = JSON.stringify(targeting)
    } catch {
      return NextResponse.json({ error: 'Invalid audienceJson format' }, { status: 400 })
    }
  }

  const testLaunch = await prisma.testLaunch.update({
    where: { id: params.id },
    data: {
      ...(body.metaBusinessId !== undefined ? { metaBusinessId: body.metaBusinessId } : {}),
      ...(body.metaAdAccountId !== undefined ? { metaAdAccountId: body.metaAdAccountId } : {}),
      ...(body.metaAccountId !== undefined ? { metaAccountId: body.metaAccountId } : {}),
      ...(body.productId !== undefined ? { productId: body.productId } : {}),
      ...(body.name !== undefined ? { name: body.name?.trim().slice(0, 200) ?? undefined } : {}),
      ...(body.objective !== undefined ? { objective: body.objective } : {}),
      ...(body.dailyBudget !== undefined ? { dailyBudget: body.dailyBudget } : {}),
      ...(body.budgetMode !== undefined ? { budgetMode: body.budgetMode } : {}),
      ...(body.currency !== undefined ? { currency: body.currency } : {}),
      ...(body.pageId !== undefined ? { pageId: body.pageId } : {}),
      ...(body.igAccountId !== undefined ? { igAccountId: body.igAccountId } : {}),
      ...(body.pixelId !== undefined ? { pixelId: body.pixelId } : {}),
      ...(body.placementMode !== undefined ? { placementMode: body.placementMode } : {}),
      ...(body.placementsJson !== undefined ? { placementsJson: body.placementsJson } : {}),
      ...(body.audienceJson !== undefined ? { audienceJson: body.audienceJson } : {}),
      ...(body.destinationUrl !== undefined ? { destinationUrl: body.destinationUrl?.trim().slice(0, 2000) ?? undefined } : {}),
      ...(body.targetingJson !== undefined ? { targetingJson: body.targetingJson } : {}),
      ...(body.launchMode !== undefined ? { launchMode: body.launchMode } : {}),
      ...(body.sourceAdsetId !== undefined ? { sourceAdsetId: body.sourceAdsetId } : {}),
      ...(body.notes !== undefined ? { notes: body.notes?.trim().slice(0, 2000) ?? undefined } : {}),
    },
    include: {
      creatives: true,
      adsets: {
        include: {
          creatives: {
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
      metaAccount: {
        select: {
          accountName: true,
          defaultAdAccountId: true,
          status: true,
        },
      },
    },
  })

  return NextResponse.json({ testLaunch })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const existing = await prisma.testLaunch.findUnique({
    where: { id: params.id },
    select: { userId: true, status: true },
  })

  if (!existing) {
    return NextResponse.json({ error: 'TestLaunch not found' }, { status: 404 })
  }

  // Only owner or admin can delete
  if (existing.userId !== auth.id && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Only allow delete if status is 'draft'
  if (existing.status !== 'draft') {
    return NextResponse.json({ error: 'Can only delete drafts' }, { status: 400 })
  }

  await prisma.testLaunch.delete({ where: { id: params.id } })

  return NextResponse.json({ success: true })
}
