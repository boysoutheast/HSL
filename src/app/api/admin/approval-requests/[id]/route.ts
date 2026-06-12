import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type AudienceShape = {
  ageMin?: number
  ageMax?: number
  gender?: string
  locations?: Array<{ type: string; key: string }>
  interests?: unknown[]
}

type BidStrategyShape = {
  strategy?: string
  bidAmount?: number
  roasAverageFloor?: number
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function parseAudienceFromTargeting(targetingJson: string | null | undefined): AudienceShape {
  const fallback: AudienceShape = {
    ageMin: 25,
    ageMax: 45,
    gender: 'all',
    locations: [{ type: 'country', key: 'ID' }],
  }

  if (!targetingJson) return fallback

  try {
    const targeting = JSON.parse(targetingJson)
    if (targeting.audience) return targeting.audience as AudienceShape
    return {
      ageMin: targeting.age_min ?? fallback.ageMin,
      ageMax: targeting.age_max ?? fallback.ageMax,
      gender: targeting.gender ?? fallback.gender,
      locations: targeting.geo_locations?.locations ?? fallback.locations,
      interests: targeting.interests ?? undefined,
    }
  } catch {
    return fallback
  }
}

function parsePlacements(placementsJson: string | null | undefined): string[] {
  return parseJson<string[]>(placementsJson, [])
}

function parseCampaignBidStrategy(notes: string | null | undefined): BidStrategyShape | null {
  if (!notes) return null
  try {
    const parsed = JSON.parse(notes)
    if (parsed && typeof parsed === 'object' && parsed.bidStrategy) {
      return parsed.bidStrategy as BidStrategyShape
    }
  } catch {
    // notes can be plain text, ignore
  }
  return null
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    status?: 'approved' | 'rejected'
    reviewNote?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.status || !['approved', 'rejected'].includes(body.status)) {
    return NextResponse.json({ error: 'status must be "approved" or "rejected"' }, { status: 400 })
  }

  const approvalRequest = await prisma.approvalRequest.findUnique({
    where: { id: params.id },
    include: {
      testLaunch: {
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
          metaAccount: true,
        },
      },
    },
  })

  if (!approvalRequest) {
    return NextResponse.json({ error: 'ApprovalRequest not found' }, { status: 404 })
  }

  if (approvalRequest.status !== 'pending') {
    return NextResponse.json({ error: 'ApprovalRequest is not pending' }, { status: 409 })
  }

  const now = new Date()

  if (body.status === 'approved') {
    const testLaunch = await prisma.testLaunch.findUnique({
      where: { id: approvalRequest.testLaunchId },
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
            id: true,
            defaultAdAccountId: true,
            accountName: true,
            currency: true,
            timezone: true,
            userId: true,
          },
        },
      },
    })

    if (!testLaunch) {
      return NextResponse.json({ error: 'TestLaunch not found' }, { status: 404 })
    }

    await prisma.testLaunch.update({
      where: { id: approvalRequest.testLaunchId },
      data: { status: 'approved' },
    })

    const audience = parseAudienceFromTargeting(testLaunch.targetingJson)
    const placements = parsePlacements(testLaunch.placementsJson)
    const selectedAdAccount = testLaunch.metaAdAccountId
      ? await prisma.metaAdAccount.findUnique({
          where: { id: testLaunch.metaAdAccountId },
          select: { adAccountId: true, adAccountName: true },
        })
      : null

    const adAccountId = selectedAdAccount?.adAccountId || testLaunch.metaAccount?.defaultAdAccountId || ''
    const budgetMode = testLaunch.budgetMode || 'CBO'
    const campaignBidStrategy = parseCampaignBidStrategy(testLaunch.notes)

    const adsetsV2 = budgetMode === 'ABO'
      ? testLaunch.adsets.map((adset, index) => {
          const adsetAudience = parseJson<AudienceShape | null>(adset.audienceJson, null)
          const adsetBidStrategy = parseJson<BidStrategyShape | null>(adset.bidStrategyJson, null)
          return {
            name: adset.name,
            dailyBudget: Number(adset.dailyBudget ?? 0),
            bidStrategy: adsetBidStrategy ?? campaignBidStrategy ?? undefined,
            audience: adsetAudience ?? audience,
            placements,
            placementMode: testLaunch.placementMode || 'automatic',
            creatives: adset.creatives.map((c) => ({
              imageUrl: c.creativeUrl || '',
              primaryText: c.primaryText || c.hookText || c.captionText || '',
              headline: c.adHeadline || c.headline || '',
              callToAction: c.callToAction || 'LEARN_MORE',
            })),
            sortOrder: adset.sortOrder ?? index,
          }
        })
      : [
          {
            name: `${testLaunch.name || `HSL Launch ${now.toISOString()}`} - Adset`,
            bidStrategy: campaignBidStrategy ?? undefined,
            audience,
            placements,
            placementMode: testLaunch.placementMode || 'automatic',
            creatives: testLaunch.creatives.map((c) => ({
              imageUrl: c.creativeUrl || '',
              primaryText: c.primaryText || c.hookText || c.captionText || '',
              headline: c.adHeadline || c.headline || '',
              callToAction: c.callToAction || 'LEARN_MORE',
            })),
            sortOrder: 0,
          },
        ]

    const payloadV2: Record<string, unknown> = {
      payloadVersion: 2,
      budgetMode,
      campaign: {
        name: testLaunch.name || `HSL Launch ${now.toISOString()}`,
        objective: testLaunch.objective || 'OUTCOME_LEADS',
        ...(budgetMode === 'CBO' ? { dailyBudget: Number(testLaunch.dailyBudget) } : {}),
        ...(budgetMode === 'CBO' && campaignBidStrategy ? { bidStrategy: campaignBidStrategy } : {}),
      },
      adsets: adsetsV2,
      adAccountId,
      pageId: testLaunch.pageId || '',
      igAccountId: testLaunch.igAccountId || '',
      pixelId: testLaunch.pixelId || '',
      metaConnectionId: testLaunch.metaAccountId,
      snapshotAt: now.toISOString(),
    }

    const legacyPayload = {
      metaConnectionId: testLaunch.metaAccountId,
      adAccountId,
      pageId: testLaunch.pageId || '',
      igAccountId: testLaunch.igAccountId || '',
      objective: testLaunch.objective || 'OUTCOME_LEADS',
      dailyBudget: Number(testLaunch.dailyBudget),
      destinationUrl: testLaunch.destinationUrl || '',
      placementMode: testLaunch.placementMode || 'automatic',
      placements,
      audience,
      creatives: testLaunch.creatives.map((c) => ({
        imageUrl: c.creativeUrl || '',
        primaryText: c.primaryText || c.hookText || c.captionText || '',
        headline: c.adHeadline || c.headline || '',
        callToAction: c.callToAction || 'LEARN_MORE',
      })),
      name: testLaunch.name || `HSL Launch ${now.toISOString()}`,
      pixelId: testLaunch.pixelId || '',
      snapshotAt: now.toISOString(),
    }

    const payload = budgetMode === 'CBO'
      ? { ...legacyPayload, ...payloadV2 }
      : payloadV2

    const taskType = budgetMode === 'ABO' ? 'create_full_launch_abo' : 'create_full_launch'

    await prisma.workerTask.create({
      data: {
        type: taskType,
        payloadJson: JSON.stringify(payload),
        status: 'pending',
        priority: 1,
        testLaunchId: approvalRequest.testLaunchId,
      },
    })
  } else {
    await prisma.testLaunch.update({
      where: { id: approvalRequest.testLaunchId },
      data: { status: 'rejected' },
    })
  }

  const updated = await prisma.approvalRequest.update({
    where: { id: params.id },
    data: {
      status: body.status,
      reviewedById: auth.id,
      reviewedAt: now,
      reviewNote: body.reviewNote ?? null,
    },
    include: {
      testLaunch: true,
      requestedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json({ approvalRequest: updated })
}
