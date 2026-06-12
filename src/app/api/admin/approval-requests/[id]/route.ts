import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { getObjectiveConfig } from '@/lib/meta-objective-matrix'
import { buildPlacementTargeting } from '@/lib/meta-placement-map'

type AudienceShape = {
  ageMin?: number
  ageMax?: number
  gender?: string
  locations?: Array<{ type: string; key: string; name?: string; country_code?: string; region_id?: string; city_id?: string }>
  customAudienceIds?: string[]
  excludedCustomAudienceIds?: string[]
}

type TargetingExtraShape = {
  interests?: Array<{ id?: string; name?: string }>
  excludedCustomAudienceIds?: string[]
  devicePlatforms?: string[]
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

function parseAudience(audienceJson: string | null | undefined, targetingJson: string | null | undefined): AudienceShape {
  const fallback: AudienceShape = {
    ageMin: 25,
    ageMax: 45,
    gender: 'all',
    locations: [{ type: 'country', key: 'ID', country_code: 'ID', name: 'Indonesia' }],
  }

  const audience = parseJson<AudienceShape | null>(audienceJson, null)
  if (audience) return { ...fallback, ...audience }

  const targeting = parseJson<Record<string, unknown> | null>(targetingJson, null)
  if (!targeting) return fallback

  const geoLocations = (targeting.geo_locations as { locations?: AudienceShape['locations'] } | undefined)?.locations

  return {
    ageMin: Number(targeting.age_min ?? fallback.ageMin),
    ageMax: Number(targeting.age_max ?? fallback.ageMax),
    gender: String(targeting.gender ?? fallback.gender),
    locations: geoLocations ?? fallback.locations,
    customAudienceIds: Array.isArray(targeting.customAudienceIds) ? (targeting.customAudienceIds as string[]) : undefined,
    excludedCustomAudienceIds: Array.isArray(targeting.excludedCustomAudienceIds) ? (targeting.excludedCustomAudienceIds as string[]) : undefined,
  }
}

function parseTargetingExtras(targetingJson: string | null | undefined): TargetingExtraShape {
  return parseJson<TargetingExtraShape>(targetingJson, {})
}

function parseBidStrategy(value: string | null | undefined): BidStrategyShape | null {
  return parseJson<BidStrategyShape | null>(value, null)
}

function mapGender(gender?: string): number[] | undefined {
  if (!gender || gender === 'all') return undefined
  if (gender === 'male') return [1]
  if (gender === 'female') return [2]
  return undefined
}

function buildGeoLocations(locations: AudienceShape['locations']): Record<string, unknown> {
  const items = Array.isArray(locations) ? locations : []
  const countries = new Set<string>()
  const regions: Array<{ key: string }> = []
  const cities: Array<{ key: string }> = []

  for (const loc of items) {
    if (!loc) continue
    if (loc.type === 'country') countries.add(loc.country_code || loc.key || 'ID')
    if (loc.type === 'region') regions.push({ key: loc.region_id || loc.key })
    if (loc.type === 'city') cities.push({ key: loc.city_id || loc.key })
  }

  return {
    ...(countries.size ? { countries: Array.from(countries) } : { countries: ['ID'] }),
    ...(regions.length ? { regions } : {}),
    ...(cities.length ? { cities } : {}),
  }
}

function buildTargeting(adset: {
  audienceJson: string | null
  targetingJson: string | null
  placementMode: string
  placementsJson: string | null
}) {
  const audience = parseAudience(adset.audienceJson, adset.targetingJson)
  const extra = parseTargetingExtras(adset.targetingJson)
  const placements = parseJson<string[]>(adset.placementsJson, [])
  const mappedPlacements = adset.placementMode === 'manual' ? buildPlacementTargeting(placements) : null

  return {
    geoLocations: buildGeoLocations(audience.locations),
    ageMin: audience.ageMin ?? 25,
    ageMax: audience.ageMax ?? 45,
    ...(mapGender(audience.gender) ? { genders: mapGender(audience.gender) } : {}),
    ...(Array.isArray(audience.customAudienceIds) && audience.customAudienceIds.length
      ? { customAudiences: audience.customAudienceIds.map((id) => ({ id })) }
      : {}),
    ...(Array.isArray(extra.excludedCustomAudienceIds) && extra.excludedCustomAudienceIds.length
      ? { excludedCustomAudiences: extra.excludedCustomAudienceIds.map((id) => ({ id })) }
      : Array.isArray(audience.excludedCustomAudienceIds) && audience.excludedCustomAudienceIds.length
        ? { excludedCustomAudiences: audience.excludedCustomAudienceIds.map((id) => ({ id })) }
        : {}),
    ...(Array.isArray(extra.interests) && extra.interests.length
      ? { flexibleSpec: [{ interests: extra.interests.map((it) => ({ id: String(it.id ?? ''), name: String(it.name ?? '') })) }] }
      : {}),
    ...(Array.isArray(extra.devicePlatforms) && extra.devicePlatforms.length ? { devicePlatforms: extra.devicePlatforms } : {}),
    ...(mappedPlacements
      ? {
          placements: {
            mode: 'manual',
            publisherPlatforms: mappedPlacements.publisher_platforms,
            ...Object.fromEntries(Object.entries(mappedPlacements).filter(([key]) => key !== 'publisher_platforms')),
          },
        }
      : { placements: { mode: 'automatic' } }),
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  let body: { status?: 'approved' | 'rejected'; reviewNote?: string }
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
          creatives: { orderBy: { sortOrder: 'asc' } },
          adsets: {
            include: { creatives: { orderBy: { sortOrder: 'asc' } } },
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
    const testLaunch = approvalRequest.testLaunch
    if (!testLaunch) return NextResponse.json({ error: 'TestLaunch not found' }, { status: 404 })

    const objectiveConfig = getObjectiveConfig(testLaunch.objective || 'OUTCOME_LEADS')
    if (!objectiveConfig) {
      return NextResponse.json({ error: 'Unsupported objective on test launch' }, { status: 400 })
    }

    await prisma.testLaunch.update({
      where: { id: approvalRequest.testLaunchId },
      data: { status: 'approved' },
    })

    const selectedAdAccount = testLaunch.metaAdAccountId
      ? await prisma.metaAdAccount.findUnique({
          where: { id: testLaunch.metaAdAccountId },
          select: { adAccountId: true },
        })
      : null

    const adAccountId = selectedAdAccount?.adAccountId || testLaunch.metaAccount?.defaultAdAccountId || ''
    const budgetMode = testLaunch.budgetMode || 'CBO'
    const campaignBidStrategy = parseBidStrategy(testLaunch.bidStrategyJson)
    const rootPlacements = parseJson<string[]>(testLaunch.placementsJson, [])

    const adsets = testLaunch.adsets.length > 0
      ? testLaunch.adsets.map((adset) => {
          const adsetBidStrategy = parseBidStrategy(adset.bidStrategyJson)
          const bidStrategy = budgetMode === 'ABO'
            ? adsetBidStrategy ?? campaignBidStrategy ?? undefined
            : undefined
          const customEventType = adset.customEventType || objectiveConfig.defaultEvent || undefined
          const targeting = buildTargeting({
            audienceJson: adset.audienceJson,
            targetingJson: adset.targetingJson,
            placementMode: adset.placementMode,
            placementsJson: adset.placementsJson,
          })

          return {
            name: adset.name,
            ...(budgetMode === 'ABO' ? { dailyBudget: Number(adset.dailyBudget ?? 0) } : {}),
            ...(bidStrategy ? { bidStrategy } : {}),
            destinationType: adset.destinationType || 'WEBSITE',
            optimizationGoal: adset.optimizationGoal || objectiveConfig.optimizationGoal,
            billingEvent: adset.billingEvent || objectiveConfig.billingEvent,
            promotedObject: adset.pixelId
              ? {
                  pixelId: adset.pixelId,
                  ...(customEventType ? { customEventType } : {}),
                }
              : undefined,
            startTime: adset.startTime?.toISOString() ?? null,
            endTime: adset.endTime?.toISOString() ?? null,
            targeting,
            ads: adset.creatives.map((creative) => ({
              identity: {
                pageId: adset.identityPageId || testLaunch.pageId || '',
                instagramUserId: adset.identityIgUserId || testLaunch.igAccountId || '',
              },
              creative: {
                format: creative.format || 'single',
                linkUrl: creative.linkUrl || testLaunch.destinationUrl || '',
                message: creative.primaryText || creative.hookText || creative.captionText || '',
                headline: creative.adHeadline || creative.headline || '',
                description: creative.description || '',
                cta: creative.callToAction || 'LEARN_MORE',
                mediaUrl: creative.creativeUrl || '',
                children: creative.childAttachmentsJson ? parseJson(creative.childAttachmentsJson, null) : null,
              },
              urlTags: creative.urlTags || '',
            })),
          }
        })
      : [
          {
            name: `${testLaunch.name} - Adset`,
            destinationType: 'WEBSITE',
            optimizationGoal: objectiveConfig.optimizationGoal,
            billingEvent: objectiveConfig.billingEvent,
            promotedObject: testLaunch.pixelId
              ? {
                  pixelId: testLaunch.pixelId,
                  ...(objectiveConfig.defaultEvent ? { customEventType: objectiveConfig.defaultEvent } : {}),
                }
              : undefined,
            startTime: null,
            endTime: null,
            targeting: {
              ...buildTargeting({
                audienceJson: testLaunch.audienceJson,
                targetingJson: testLaunch.targetingJson,
                placementMode: testLaunch.placementMode,
                placementsJson: JSON.stringify(rootPlacements),
              }),
            },
            ads: testLaunch.creatives.map((creative) => ({
              identity: {
                pageId: testLaunch.pageId || '',
                instagramUserId: testLaunch.igAccountId || '',
              },
              creative: {
                format: creative.format || 'single',
                linkUrl: creative.linkUrl || testLaunch.destinationUrl || '',
                message: creative.primaryText || creative.hookText || creative.captionText || '',
                headline: creative.adHeadline || creative.headline || '',
                description: creative.description || '',
                cta: creative.callToAction || 'LEARN_MORE',
                mediaUrl: creative.creativeUrl || '',
                children: creative.childAttachmentsJson ? parseJson(creative.childAttachmentsJson, null) : null,
              },
              urlTags: creative.urlTags || '',
            })),
          },
        ]

    const payload = {
      payloadVersion: 3,
      budgetMode,
      campaign: {
        name: testLaunch.name,
        objective: testLaunch.objective,
        specialAdCategories: [],
        ...(budgetMode === 'CBO' ? { dailyBudget: Number(testLaunch.dailyBudget) } : {}),
        ...(budgetMode === 'CBO' && campaignBidStrategy ? { bidStrategy: campaignBidStrategy } : {}),
        ...(budgetMode === 'ABO' ? { isAdsetBudgetSharingEnabled: false } : {}),
      },
      adsets,
      adAccountId,
      metaConnectionId: testLaunch.metaAccountId,
      snapshotAt: now.toISOString(),
    }

    await prisma.workerTask.create({
      data: {
        type: 'create_full_launch_v3',
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
