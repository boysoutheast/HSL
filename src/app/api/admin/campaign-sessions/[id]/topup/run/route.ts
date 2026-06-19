import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/admin/campaign-sessions/[id]/topup/run
 * Manual trigger — evaluate floor now (for testing).
 * Returns { activeAds, minActiveAds, action, topupLogId?, created }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const session = await prisma.campaignSession.findFirst({
    where: { id: params.id, userId: auth.id },
    select: { id: true, minActiveAds: true, topupEnabled: true, topupTargetAdsetId: true },
  })
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  if (!session.topupEnabled || session.minActiveAds <= 0) {
    return NextResponse.json({ error: 'Top-up not enabled or minActiveAds = 0' }, { status: 422 })
  }

  // Count active ads from MetaEntity
  const activeAds = await prisma.metaEntity.count({
    where: { campaignSessionId: params.id, entityType: 'AD', effectiveStatus: 'ACTIVE' },
  })

  // Count in-flight PENDING CREATE_AD — prevent floor overshoot on parallel calls
  const inflightCreateAd = await prisma.automationAction.count({
    where: { campaignSessionId: params.id, actionType: 'CREATE_AD', status: 'PENDING' },
  })

  const need = Math.max(0, session.minActiveAds - activeAds - inflightCreateAd)

  if (need <= 0) {
    return NextResponse.json({
      activeAds,
      minActiveAds: session.minActiveAds,
      inflightCreateAd,
      action: 'skipped',
      note: 'Floor not breached (including inflight)',
    })
  }

  // Floor breached — claim creative
  let created = 0
  let skippedEmptyPool = false

  for (let i = 0; i < need; i++) {
    // Atomic claim: find available, update where status='available'
    const poolItem = await prisma.campaignCreativePool.findFirst({
      where: { campaignSessionId: params.id, status: 'available' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, primaryText: true, headline: true, description: true, callToAction: true, linkUrl: true, mediaAssetId: true, creativeUrl: true },
    })

    if (!poolItem) {
      skippedEmptyPool = true
      break
    }

    // Atomic: only claim if still available (race-safe)
    const claimResult = await prisma.campaignCreativePool.updateMany({
      where: { id: poolItem.id, status: 'available' },
      data: { status: 'used', usedAt: new Date() },
    })

    if (claimResult.count === 0) {
      // Another scan claimed this one — retry next item
      i-- // don't count this iteration
      continue
    }

    // Create AutomationAction
    const idempotencyKey = `topup_${params.id}_${poolItem.id}`
    const existingAction = await prisma.automationAction.findUnique({
      where: { idempotencyKey },
      select: { id: true },
    })

    let actionId: string
    if (existingAction) {
      actionId = existingAction.id
    } else {
      const action = await prisma.automationAction.create({
        data: {
          userId: auth.id,
          campaignSessionId: params.id,
          source: 'SYSTEM',
          actionType: 'CREATE_AD',
          payloadJson: JSON.stringify({
            campaignSessionId: params.id,
            adsetId: session.topupTargetAdsetId ?? null,
            primaryText: poolItem.primaryText,
            headline: poolItem.headline,
            description: poolItem.description,
            callToAction: poolItem.callToAction,
            linkUrl: poolItem.linkUrl,
            mediaAssetId: poolItem.mediaAssetId,
            creativeUrl: poolItem.creativeUrl,
          }),
          status: 'PENDING',
          idempotencyKey,
          priority: 3,
          requestedAt: new Date(),
        },
      })
      actionId = action.id
    }

    // Create topup log
    await prisma.campaignTopupLog.create({
      data: {
        campaignSessionId: params.id,
        activeAdsBefore: activeAds,
        minActiveAds: session.minActiveAds,
        poolCreativeId: poolItem.id,
        automationActionId: actionId,
        status: 'pending',
      },
    })

    created++
  }

  // Pool exhaustion — NOTIFY (cooldown 60m)
  if (skippedEmptyPool) {
    // Check last notification within 60m
    const lastNotify = await prisma.campaignTopupLog.findFirst({
      where: {
        campaignSessionId: params.id,
        status: 'skipped_empty_pool',
        triggeredAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
      orderBy: { triggeredAt: 'desc' },
    })
    if (!lastNotify) {
      await prisma.automationAction.create({
        data: {
          userId: auth.id,
          campaignSessionId: params.id,
          source: 'SYSTEM',
          actionType: 'NOTIFY',
          payloadJson: JSON.stringify({
            kind: 'pool_exhausted',
            campaignSessionId: params.id,
            activeAdsBefore: activeAds,
            minActiveAds: session.minActiveAds,
          }),
          status: 'PENDING',
          idempotencyKey: `topup_notify_pool_${params.id}_${Date.now()}`,
          priority: 5,
          requestedAt: new Date(),
        },
      })
      await prisma.campaignTopupLog.create({
        data: {
          campaignSessionId: params.id,
          activeAdsBefore: activeAds,
          minActiveAds: session.minActiveAds,
          status: 'skipped_empty_pool',
          note: 'Pool exhausted — notified',
        },
      })
    }
  }

  return NextResponse.json({
    activeAds,
    minActiveAds: session.minActiveAds,
    action: 'created',
    created,
    skippedEmptyPool,
  })
}
