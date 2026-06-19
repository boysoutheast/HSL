import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateApiKey, unauthorizedResponse } from '../../../../_lib/api-key-auth'

export const runtime = 'nodejs'

/**
 * POST /api/internal/campaign-sessions/[id]/topup-claim
 * Worker-callable — atomic pool claim. Creates AutomationAction CREATE_AD.
 * Flow: count active AD → if floor breached → atomic claim creative → create action + log
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!validateApiKey(req)) return unauthorizedResponse()

  const session = await prisma.campaignSession.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, minActiveAds: true, topupEnabled: true, topupTargetAdsetId: true },
  })
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  if (!session.topupEnabled || session.minActiveAds <= 0) {
    return NextResponse.json({ action: 'skip', reason: 'not_enabled' })
  }

  // Count active ads
  const activeAds = await prisma.metaEntity.count({
    where: { campaignSessionId: params.id, entityType: 'AD', effectiveStatus: 'ACTIVE' },
  })

  if (activeAds >= session.minActiveAds) {
    return NextResponse.json({ action: 'skip', reason: 'floor_not_breached', activeAds, minActiveAds: session.minActiveAds })
  }

  // Floor breached — claim
  const need = session.minActiveAds - activeAds
  let created = 0
  let skippedEmptyPool = false

  for (let i = 0; i < need; i++) {
    // Find next available creative
    const poolItem = await prisma.campaignCreativePool.findFirst({
      where: { campaignSessionId: params.id, status: 'available' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, primaryText: true, headline: true, description: true, callToAction: true, linkUrl: true, mediaAssetId: true, creativeUrl: true },
    })

    if (!poolItem) {
      skippedEmptyPool = true
      break
    }

    // Atomic claim — conditional updateMany
    const claimResult = await prisma.campaignCreativePool.updateMany({
      where: { id: poolItem.id, status: 'available' },
      data: { status: 'used', usedAt: new Date() },
    })

    if (claimResult.count === 0) {
      i-- // retry
      continue
    }

    // Create AutomationAction with idempotency key
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
          userId: session.userId,
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
          userId: session.userId,
          campaignSessionId: params.id,
          source: 'SYSTEM',
          actionType: 'NOTIFY',
          payloadJson: JSON.stringify({ kind: 'pool_exhausted', campaignSessionId: params.id }),
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
    action: created > 0 ? 'created' : skippedEmptyPool ? 'pool_empty' : 'no_action',
    created,
    skippedEmptyPool,
    activeAds,
    minActiveAds: session.minActiveAds,
  })
}
