import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, ownerFilter } from '@/lib/auth'
import { getObjectiveConfig } from '@/lib/meta-objective-matrix'

export const dynamic = 'force-dynamic'

type JsonRecord = Record<string, unknown>
type CreativeInput = Record<string, unknown>
type AdsetInput = Record<string, unknown>

function isValidUrl(value: unknown): boolean {
  if (!value || typeof value !== 'string') return false
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

function normalizeAudienceJson(input: unknown): string | null {
  if (!input) return null
  if (typeof input === 'string') return input
  return JSON.stringify(input)
}

function normalizeTargetingJson(input: unknown): string | null {
  if (!input) return null
  if (typeof input === 'string') return input
  return JSON.stringify(input)
}

function validateCreative(creative: CreativeInput, adsetName: string): string | null {
  const label = adsetName ? `Adset "${adsetName}"` : 'Creative'

  if (!creative.linkUrl || !isValidUrl(creative.linkUrl)) {
    return `${label}: linkUrl is required and must be a valid URL`
  }
  if (creative.primaryText && String(creative.primaryText).length > 125) {
    return `${label}: primaryText must be 125 chars or less`
  }
  if (creative.headline && String(creative.headline).length > 255) {
    return `${label}: headline must be 255 chars or less`
  }

  const format = (creative.format as string | undefined) ?? 'single'
  if (format === 'carousel') {
    const cards = Array.isArray(creative.childAttachments) ? creative.childAttachments : []
    if (cards.length < 2 || cards.length > 10) {
      return `${label}: carousel must have 2 to 10 cards`
    }
    for (const card of cards) {
      if (!card || typeof card !== 'object') return `${label}: invalid carousel card`
      const item = card as JsonRecord
      if (!item.mediaUrl || !item.linkUrl || !isValidUrl(item.linkUrl)) {
        return `${label}: each carousel card requires mediaUrl and valid linkUrl`
      }
    }
  }

  return null
}

function deriveLegacyTargeting(audienceJson: unknown): string | null {
  if (!audienceJson) return null
  try {
    const audience = typeof audienceJson === 'string' ? JSON.parse(audienceJson) : audienceJson
    if (!audience || typeof audience !== 'object') return null
    const src = audience as JsonRecord
    const targeting: Record<string, unknown> = {
      age_min: src.ageMin ?? 18,
      age_max: src.ageMax ?? 65,
    }
    if (src.gender && src.gender !== 'all') targeting.gender = src.gender
    if (Array.isArray(src.locations) && src.locations.length > 0) {
      targeting.geo_locations = { locations: src.locations }
    }
    if (Array.isArray(src.interests) && src.interests.length > 0) {
      targeting.interests = src.interests
    }
    return JSON.stringify(targeting)
  } catch {
    return null
  }
}

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
      adsets: {
        include: {
          creatives: { orderBy: { sortOrder: 'asc' } },
        },
        orderBy: { sortOrder: 'asc' },
      },
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

  let body: JsonRecord
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const budgetMode = (body.budgetMode as string | undefined) ?? 'CBO'
  if (budgetMode !== 'CBO' && budgetMode !== 'ABO') {
    return NextResponse.json({ error: 'budgetMode must be CBO or ABO' }, { status: 400 })
  }

  if (!body.metaAccountId || !body.name || !body.objective || !body.launchMode) {
    return NextResponse.json({ error: 'metaAccountId, name, objective, and launchMode are required' }, { status: 400 })
  }

  const objectiveConfig = getObjectiveConfig(String(body.objective))
  if (!objectiveConfig) {
    return NextResponse.json({ error: 'Unsupported objective' }, { status: 400 })
  }

  const rootAudienceJson = normalizeAudienceJson(body.audienceJson)
  const rootTargetingJson = normalizeTargetingJson(body.targetingJson) ?? deriveLegacyTargeting(rootAudienceJson)
  const flatCreatives = Array.isArray(body.creatives) ? (body.creatives as CreativeInput[]) : []
  const rawAdsets = Array.isArray(body.adsets) ? (body.adsets as AdsetInput[]) : null

  let normalizedAdsets: Array<AdsetInput & { creatives: CreativeInput[] }> = []

  if (rawAdsets && rawAdsets.length > 0) {
    normalizedAdsets = rawAdsets.map((adset) => ({
      ...adset,
      creatives: Array.isArray(adset.creatives) ? (adset.creatives as CreativeInput[]) : [],
    }))
  } else if (budgetMode === 'CBO') {
    normalizedAdsets = [
      {
        name: `${String(body.name).trim()} - Adset`,
        dailyBudget: null,
        bidStrategy: body.bidStrategy,
        audienceJson: rootAudienceJson,
        targetingJson: rootTargetingJson,
        placementMode: (body.placementMode as string | undefined) ?? 'automatic',
        placements: body.placements,
        pixelId: body.pixelId,
        customEventType: body.customEventType,
        identityPageId: body.pageId,
        identityIgUserId: body.igAccountId,
        creatives: flatCreatives,
      },
    ]
  }

  if (budgetMode === 'ABO') {
    if (body.dailyBudget !== undefined && body.dailyBudget !== null) {
      return NextResponse.json({ error: 'ABO: budget diisi per adset, bukan campaign' }, { status: 400 })
    }
    if (!normalizedAdsets.length) {
      return NextResponse.json({ error: 'ABO: at least 1 adset is required' }, { status: 400 })
    }
  } else {
    if (body.dailyBudget === undefined || body.dailyBudget === null || Number(body.dailyBudget) <= 0) {
      return NextResponse.json({ error: 'CBO: dailyBudget is required and must be greater than 0' }, { status: 400 })
    }
  }

  let totalBudget = 0

  for (let i = 0; i < normalizedAdsets.length; i++) {
    const adset = normalizedAdsets[i]
    const adsetName = String(adset.name || `Adset ${i + 1}`).trim()
    if (!adsetName) {
      return NextResponse.json({ error: `Adset #${i + 1} requires a name` }, { status: 400 })
    }

    if (budgetMode === 'ABO') {
      if (adset.dailyBudget === undefined || adset.dailyBudget === null || Number(adset.dailyBudget) <= 0) {
        return NextResponse.json({ error: `ABO: adset "${adsetName}" requires dailyBudget > 0` }, { status: 400 })
      }
      totalBudget += Number(adset.dailyBudget)
    } else if (adset.dailyBudget !== undefined && adset.dailyBudget !== null && Number(adset.dailyBudget) > 0) {
      return NextResponse.json({ error: 'CBO: adset dailyBudget must be empty' }, { status: 400 })
    }

    const pixelId = (adset.pixelId as string | undefined) ?? (body.pixelId as string | undefined)
    const customEventType = (adset.customEventType as string | undefined) ?? (body.customEventType as string | undefined)
    if (objectiveConfig.pixelRequired && !pixelId) {
      return NextResponse.json({ error: `${adsetName}: pixelId is required for ${body.objective}` }, { status: 400 })
    }
    if (objectiveConfig.eventRequired && !customEventType) {
      return NextResponse.json({ error: `${adsetName}: customEventType is required for ${body.objective}` }, { status: 400 })
    }

    const identityPageId = (adset.identityPageId as string | undefined) ?? (body.pageId as string | undefined)
    if (!identityPageId) {
      return NextResponse.json({ error: `${adsetName}: identityPageId is required` }, { status: 400 })
    }

    const placementMode = (adset.placementMode as string | undefined) ?? 'automatic'
    const placements = Array.isArray(adset.placements)
      ? (adset.placements as unknown[])
      : Array.isArray(adset.placementsJson)
        ? (adset.placementsJson as unknown[])
        : []
    if (placementMode === 'manual' && placements.length === 0) {
      return NextResponse.json({ error: `${adsetName}: manual placement requires at least 1 token` }, { status: 400 })
    }

    if (adset.startTime && adset.endTime) {
      const start = new Date(String(adset.startTime))
      const end = new Date(String(adset.endTime))
      if (!(start < end)) {
        return NextResponse.json({ error: `${adsetName}: endTime must be after startTime` }, { status: 400 })
      }
    }

    if (!adset.creatives || adset.creatives.length === 0) {
      return NextResponse.json({ error: `${adsetName}: at least 1 creative is required` }, { status: 400 })
    }
    for (const creative of adset.creatives) {
      const creativeError = validateCreative(creative, adsetName)
      if (creativeError) {
        return NextResponse.json({ error: creativeError }, { status: 400 })
      }
    }
  }

  if (budgetMode === 'CBO') {
    totalBudget = Number(body.dailyBudget)
  }

  const testLaunch = await prisma.$transaction(async (tx) => {
    const launch = await tx.testLaunch.create({
      data: {
        userId: auth.id,
        budgetMode,
        metaAccountId: String(body.metaAccountId),
        metaBusinessId: (body.metaBusinessId as string) || undefined,
        metaAdAccountId: (body.metaAdAccountId as string) || undefined,
        productId: (body.productId as string) || undefined,
        name: String(body.name),
        objective: String(body.objective),
        dailyBudget: totalBudget,
        currency: (body.currency as string) ?? 'IDR',
        pageId: (body.pageId as string) || undefined,
        igAccountId: (body.igAccountId as string) || undefined,
        pixelId: (body.pixelId as string) || undefined,
        placementMode: (body.placementMode as string) ?? 'automatic',
        placementsJson: typeof body.placementsJson === 'string' ? (body.placementsJson as string) : undefined,
        audienceJson: rootAudienceJson ?? undefined,
        destinationUrl: (body.destinationUrl as string) || undefined,
        targetingJson: rootTargetingJson ?? undefined,
        launchMode: String(body.launchMode),
        sourceAdsetId: (body.sourceAdsetId as string) || undefined,
        notes: (body.notes as string) || undefined,
        ...(flatCreatives.length > 0 && budgetMode === 'CBO'
          ? {
              creatives: {
                create: flatCreatives.map((creative, index) => ({
                  creativeUrl: (creative.creativeUrl as string) || undefined,
                  captionText: (creative.captionText as string) || undefined,
                  hookText: (creative.hookText as string) || undefined,
                  headline: (creative.headline as string) || undefined,
                  primaryText: (creative.primaryText as string) || undefined,
                  adHeadline: (creative.adHeadline as string) || undefined,
                  callToAction: (creative.callToAction as string) || undefined,
                  format: (creative.format as string) ?? 'single',
                  linkUrl: (creative.linkUrl as string) || undefined,
                  description: (creative.description as string) || undefined,
                  urlTags: (creative.urlTags as string) || undefined,
                  childAttachmentsJson: creative.childAttachments ? JSON.stringify(creative.childAttachments) : undefined,
                  videoId: (creative.videoId as string) || undefined,
                  sortOrder: (creative.sortOrder as number) ?? index,
                })),
              },
            }
          : {}),
      },
    })

    for (let i = 0; i < normalizedAdsets.length; i++) {
      const adset = normalizedAdsets[i]
      const adsetName = String(adset.name || `Adset ${i + 1}`).trim()
      const adsetAudienceJson = normalizeAudienceJson(adset.audienceJson) ?? rootAudienceJson
      const adsetTargetingJson = normalizeTargetingJson(adset.targetingJson) ?? deriveLegacyTargeting(adsetAudienceJson) ?? rootTargetingJson
      const customEventType = ((adset.customEventType as string | undefined) ?? (body.customEventType as string | undefined) ?? objectiveConfig.defaultEvent) || undefined

      await tx.testLaunchAdset.create({
        data: {
          testLaunchId: launch.id,
          name: adsetName,
          dailyBudget: budgetMode === 'ABO' ? Number(adset.dailyBudget) : null,
          bidStrategyJson: adset.bidStrategy ? JSON.stringify(adset.bidStrategy) : budgetMode === 'ABO' ? null : body.bidStrategy ? JSON.stringify(body.bidStrategy) : null,
          audienceJson: adsetAudienceJson ?? undefined,
          destinationType: 'WEBSITE',
          optimizationGoal: objectiveConfig.optimizationGoal,
          billingEvent: objectiveConfig.billingEvent,
          pixelId: ((adset.pixelId as string | undefined) ?? (body.pixelId as string | undefined)) || undefined,
          customEventType,
          startTime: adset.startTime ? new Date(String(adset.startTime)) : undefined,
          endTime: adset.endTime ? new Date(String(adset.endTime)) : undefined,
          placementMode: (adset.placementMode as string | undefined) ?? 'automatic',
          placementsJson: Array.isArray(adset.placements)
            ? JSON.stringify(adset.placements)
            : typeof adset.placementsJson === 'string'
              ? (adset.placementsJson as string)
              : undefined,
          targetingJson: adsetTargetingJson ?? undefined,
          identityPageId: ((adset.identityPageId as string | undefined) ?? (body.pageId as string | undefined)) || undefined,
          identityIgUserId: ((adset.identityIgUserId as string | undefined) ?? (body.igAccountId as string | undefined)) || undefined,
          sortOrder: i,
          status: 'pending',
          creatives: {
            create: adset.creatives.map((creative, index) => ({
              testLaunchId: launch.id,
              creativeUrl: (creative.creativeUrl as string) || undefined,
              captionText: (creative.captionText as string) || undefined,
              hookText: (creative.hookText as string) || undefined,
              headline: (creative.headline as string) || undefined,
              primaryText: (creative.primaryText as string) || undefined,
              adHeadline: (creative.adHeadline as string) || undefined,
              callToAction: (creative.callToAction as string) || undefined,
              format: (creative.format as string) ?? 'single',
              linkUrl: (creative.linkUrl as string) || undefined,
              description: (creative.description as string) || undefined,
              urlTags: (creative.urlTags as string) || undefined,
              childAttachmentsJson: creative.childAttachments ? JSON.stringify(creative.childAttachments) : undefined,
              videoId: (creative.videoId as string) || undefined,
              sortOrder: (creative.sortOrder as number) ?? index,
            })),
          },
        },
      })
    }

    return launch.id
  })

  const result = await prisma.testLaunch.findUnique({
    where: { id: testLaunch },
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
