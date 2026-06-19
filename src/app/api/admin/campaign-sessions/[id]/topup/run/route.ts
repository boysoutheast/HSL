import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { createAd, resolvePageId, TokenError, RateLimitError } from '@/lib/meta-client'
import { canWriteToAdAccount, markAccountHealthy, markAccountNeedsReconnect } from '@/lib/write-guard'
import { resolvePoolMediaUrl } from '@/lib/creative-media'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/admin/campaign-sessions/[id]/topup/run
 * Manual trigger — evaluate floor now, create ad(s) via Meta API langsung (PAUSED).
 * Returns { activeAds, minActiveAds, created, poolEmpty, adIds, action }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const session = await prisma.campaignSession.findFirst({
    where: { id: params.id, userId: auth.id },
    select: {
      id: true,
      userId: true,
      minActiveAds: true,
      topupEnabled: true,
      topupTargetAdsetId: true,
      metaAdAccountId: true,
      metaAdAccount: {
        select: { id: true, adAccountId: true },
      },
    },
  })
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  if (!session.topupEnabled || session.minActiveAds <= 0) {
    return NextResponse.json({ error: 'Top-up not enabled or minActiveAds = 0' }, { status: 422 })
  }

  const metaAdAccountId = session.metaAdAccount?.id ?? null
  const adAccountId = session.metaAdAccount?.adAccountId
  if (!metaAdAccountId || !adAccountId) {
    return NextResponse.json({ error: 'No Meta ad account linked' }, { status: 422 })
  }

  // ★ Write gate: ownership + token check
  const writeCheck = await canWriteToAdAccount(session.userId, metaAdAccountId)
  if (!writeCheck.ok) {
    return NextResponse.json({ error: writeCheck.reason ?? 'Write access denied' }, { status: 403 })
  }
  const token = writeCheck.token!
  await markAccountHealthy(metaAdAccountId)

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

  // Floor breached — claim + create
  let created = 0
  let skippedEmptyPool = false
  const adIds: string[] = []
  const errors: string[] = []

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
      i--
      continue
    }

    // ★ Create ad via Meta API langsung (PAUSED)
    let adResult: { adId: string; creativeId: string } | null = null
    try {
      const adAccountIdNum = adAccountId.replace(/^act_/, '')
      const pageId = await resolvePageId(adAccountIdNum, token, {
        sessionId: session.id,
        metaAdAccountId,
      })
      const mediaUrl = await resolvePoolMediaUrl(poolItem)
      adResult = await createAd({
        adAccountId: adAccountIdNum,
        pageId,
        name: `Topup-${poolItem.headline?.slice(0, 30) ?? 'Ad'}-${Date.now()}`,
        adsetId: session.topupTargetAdsetId ?? '',
        primaryText: poolItem.primaryText,
        headline: poolItem.headline ?? '',
        description: poolItem.description ?? '',
        callToAction: poolItem.callToAction ?? 'LEARN_MORE',
        linkUrl: poolItem.linkUrl ?? '',
        mediaUrl,
        status: 'PAUSED',
      }, token)
    } catch (err: any) {
      // Mark failed — update pool item + create topup log
      await prisma.campaignCreativePool.update({
        where: { id: poolItem.id },
        data: { status: 'failed', failedReason: err?.message ?? 'Unknown error' },
      })
      await prisma.campaignTopupLog.create({
        data: {
          campaignSessionId: params.id,
          activeAdsBefore: activeAds,
          minActiveAds: session.minActiveAds,
          poolCreativeId: poolItem.id,
          status: 'failed',
          note: err?.message ?? 'Unknown error',
        },
      })
      errors.push(err?.message ?? 'Unknown error')

      // Mark reconnect if token error
      if (err instanceof TokenError) {
        await markAccountNeedsReconnect(metaAdAccountId)
      }
      continue
    }

    if (!adResult) continue

    adIds.push(adResult.adId)

    // Log success
    await prisma.campaignTopupLog.create({
      data: {
        campaignSessionId: params.id,
        activeAdsBefore: activeAds,
        minActiveAds: session.minActiveAds,
        poolCreativeId: poolItem.id,
        automationActionId: `direct-${adResult.adId}`,
        status: 'succeeded',
        note: `Ad ${adResult.adId} created PAUSED`,
      },
    })

    // Link MetaEntity
    await prisma.metaEntity.create({
      data: {
        campaignSessionId: params.id,
        userId: session.userId,
        metaAdAccountId,
        entityType: 'AD',
        metaEntityId: adResult.adId,
        name: poolItem.headline ?? poolItem.primaryText.slice(0, 60),
        effectiveStatus: 'PAUSED',
        configuredStatus: 'PAUSED',
        lastSyncedAt: new Date(),
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
          idempotencyKey: `topup_run_notify_pool_${params.id}_${Date.now()}`,
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
    action: created > 0 ? 'created' : skippedEmptyPool ? 'skipped_empty_pool' : 'done',
    created,
    skippedEmptyPool,
    adIds,
    errors: errors.length > 0 ? errors : undefined,
  })
}
