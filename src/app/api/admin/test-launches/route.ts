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

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const budgetMode = (body.budgetMode as string) || 'CBO'
  if (budgetMode !== 'CBO' && budgetMode !== 'ABO') {
    return NextResponse.json({ error: 'budgetMode must be CBO or ABO' }, { status: 400 })
  }

  // Common required fields
  if (!body.metaAccountId || !body.name || !body.objective || !body.launchMode) {
    return NextResponse.json({ error: 'metaAccountId, name, objective, and launchMode are required' }, { status: 400 })
  }

  // ── CBO Validation ──
  if (budgetMode === 'CBO') {
    if (body.dailyBudget === undefined || body.dailyBudget === null) {
      return NextResponse.json({ error: 'CBO: dailyBudget is required' }, { status: 400 })
    }
    if (Number(body.dailyBudget) <= 0) {
      return NextResponse.json({ error: 'dailyBudget must be greater than 0' }, { status: 400 })
    }
    if (body.adsets !== undefined) {
      return NextResponse.json({ error: 'CBO: adsets should not be provided' }, { status: 400 })
    }
    const creativesArr = body.creatives as Array<Record<string, unknown>> | undefined

    // Validate creative text limits
    if (creativesArr) {
      for (const c of creativesArr) {
        if (c.primaryText && String(c.primaryText).length > 125) {
          return NextResponse.json({ error: 'primaryText must be 125 chars or less' }, { status: 400 })
        }
        if (c.headline && String(c.headline).length > 255) {
          return NextResponse.json({ error: 'headline must be 255 chars or less' }, { status: 400 })
        }
      }
    }

    const testLaunch = await prisma.testLaunch.create({
      data: {
        userId: auth.id,
        budgetMode: 'CBO',
        metaAccountId: body.metaAccountId as string,
        metaBusinessId: body.metaBusinessId as string | undefined,
        metaAdAccountId: body.metaAdAccountId as string | undefined,
        productId: body.productId as string | undefined,
        name: body.name as string,
        objective: body.objective as string,
        dailyBudget: Number(body.dailyBudget),
        currency: (body.currency as string) ?? 'IDR',
        pageId: body.pageId as string | undefined,
        igAccountId: body.igAccountId as string | undefined,
        pixelId: body.pixelId as string | undefined,
        placementMode: (body.placementMode as string) ?? 'automatic',
        placementsJson: body.placementsJson as string | undefined,
        audienceJson: body.audienceJson as string | undefined,
        destinationUrl: body.destinationUrl as string | undefined,
        targetingJson: body.targetingJson as string | undefined,
        launchMode: body.launchMode as string,
        sourceAdsetId: body.sourceAdsetId as string | undefined,
        notes: body.notes as string | undefined,
        ...(creativesArr && creativesArr.length > 0
          ? {
              creatives: {
                create: creativesArr.map((c: Record<string, unknown>, i: number) => ({
                  creativeUrl: (c.creativeUrl as string) || undefined,
                  captionText: (c.captionText as string) || undefined,
                  hookText: (c.hookText as string) || undefined,
                  headline: (c.headline as string) || undefined,
                  primaryText: (c.primaryText as string) || undefined,
                  adHeadline: (c.adHeadline as string) || undefined,
                  callToAction: (c.callToAction as string) || undefined,
                  sortOrder: (c.sortOrder as number) ?? i,
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

  // ── ABO Validation ──
  if (body.dailyBudget !== undefined && body.dailyBudget !== null) {
    return NextResponse.json({ error: 'ABO: budget is per adset, not campaign. Remove dailyBudget from root.' }, { status: 400 })
  }

  const adsets = body.adsets as Array<Record<string, unknown>> | undefined
  if (!adsets || adsets.length === 0) {
    return NextResponse.json({ error: 'ABO: at least 1 adset is required' }, { status: 400 })
  }

  for (let i = 0; i < adsets.length; i++) {
    const a = adsets[i]
    if (!a.name || String(a.name).trim() === '') {
      return NextResponse.json({ error: `ABO: adset #${i + 1} requires a name` }, { status: 400 })
    }
    if (a.dailyBudget === undefined || a.dailyBudget === null || Number(a.dailyBudget) <= 0) {
      return NextResponse.json({ error: `ABO: adset "${a.name}" requires dailyBudget > 0` }, { status: 400 })
    }
    const adCreatives = a.creatives as Array<Record<string, unknown>> | undefined
    if (!adCreatives || adCreatives.length === 0) {
      return NextResponse.json({ error: `ABO: adset "${a.name}" requires at least 1 creative` }, { status: 400 })
    }
    for (const c of adCreatives) {
      if (c.primaryText && String(c.primaryText).length > 125) {
        return NextResponse.json({ error: `ABO: adset "${a.name}" creative primaryText must be 125 chars or less` }, { status: 400 })
      }
      if (c.headline && String(c.headline).length > 255) {
        return NextResponse.json({ error: `ABO: adset "${a.name}" creative headline must be 255 chars or less` }, { status: 400 })
      }
    }
  }

  // Compute total budget for denormalized display
  const totalBudget = adsets.reduce((sum, a) => sum + Number(a.dailyBudget || 0), 0)

  // $transaction: create TestLaunch → create adsets → create creatives
  const testLaunch = await prisma.$transaction(async (tx) => {
    const launch = await tx.testLaunch.create({
      data: {
        userId: auth.id,
        budgetMode: 'ABO',
        dailyBudget: totalBudget,
        metaAccountId: body.metaAccountId as string,
        metaBusinessId: body.metaBusinessId as string | undefined,
        metaAdAccountId: body.metaAdAccountId as string | undefined,
        productId: body.productId as string | undefined,
        name: body.name as string,
        objective: body.objective as string,
        currency: (body.currency as string) ?? 'IDR',
        pageId: body.pageId as string | undefined,
        igAccountId: body.igAccountId as string | undefined,
        pixelId: body.pixelId as string | undefined,
        placementMode: (body.placementMode as string) ?? 'automatic',
        placementsJson: body.placementsJson as string | undefined,
        audienceJson: body.audienceJson as string | undefined,
        destinationUrl: body.destinationUrl as string | undefined,
        targetingJson: body.targetingJson as string | undefined,
        launchMode: body.launchMode as string,
        sourceAdsetId: body.sourceAdsetId as string | undefined,
        notes: body.notes as string | undefined,
      },
    })

    // Create adsets with nested creatives
    for (let i = 0; i < adsets.length; i++) {
      const a = adsets[i]
      const adCreatives = a.creatives as Array<Record<string, unknown>>

      await tx.testLaunchAdset.create({
        data: {
          testLaunchId: launch.id,
          name: String(a.name).trim(),
          dailyBudget: Number(a.dailyBudget),
          bidStrategyJson: a.bidStrategy ? JSON.stringify(a.bidStrategy) : null,
          audienceJson: a.audienceJson ? String(a.audienceJson) : null,
          sortOrder: i,
          status: 'pending',
          creatives: {
            create: adCreatives.map((c: Record<string, unknown>, ci: number) => ({
              testLaunchId: launch.id,
              creativeUrl: (c.creativeUrl as string) || undefined,
              captionText: (c.captionText as string) || undefined,
              hookText: (c.hookText as string) || undefined,
              headline: (c.headline as string) || undefined,
              primaryText: (c.primaryText as string) || undefined,
              adHeadline: (c.adHeadline as string) || undefined,
              callToAction: (c.callToAction as string) || undefined,
              sortOrder: ci,
            })),
          },
        },
      })
    }

    return launch
  })

  // Fetch full result with adsets + creatives
  const result = await prisma.testLaunch.findUnique({
    where: { id: testLaunch.id },
    include: {
      creatives: true,
      adsets: {
        include: { creatives: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { sortOrder: 'asc' },
      },
      metaAccount: {
        select: { accountName: true, defaultAdAccountId: true, status: true },
      },
    },
  })

  return NextResponse.json({ testLaunch: result }, { status: 201 })
}
