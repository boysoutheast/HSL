/**
 * POST /api/cron/topup-campaigns
 * Batched cron: evaluate floor, atomic claim pool, create ad via Meta API.
 * Write gate: ownership-driven via canWriteToAdAccount() — NOT env allowlist.
 * Strict opt-in: topupEnabled=true + nextMonitorAt due.
 * Selaraskan interval ke monitorIntervalMinutes campaign.
 * Auth: x-cron-secret (CRON_SECRET env)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAd, resolvePageId, TokenError, RateLimitError } from '@/lib/meta-client'
import { canWriteToAdAccount, markAccountNeedsReconnect, markAccountHealthy } from '@/lib/write-guard'
import { notify } from '@/lib/notify'
import { resolvePoolMediaUrl } from '@/lib/creative-media'

export const dynamic = 'force-dynamic'

const LIMIT = 30

function checkAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('x-cron-secret') === secret
    || req.headers.get('authorization') === `Bearer ${secret}`
}

async function run() {
  const now = new Date()

  // Strict opt-in + nextMonitorAt gating
  const sessions = await prisma.campaignSession.findMany({
    where: {
      topupEnabled: true,
      minActiveAds: { gt: 0 },
      OR: [
        { nextMonitorAt: { lte: now } },
        { nextMonitorAt: null },
      ],
    },
    take: LIMIT,
    orderBy: { nextMonitorAt: { sort: 'asc', nulls: 'first' } },
    select: {
      id: true,
      userId: true,
      minActiveAds: true,
      topupTargetAdsetId: true,
      metaAdAccountId: true,
      monitorIntervalMinutes: true,
      metaAdAccount: {
        select: {
          id: true,
          adAccountId: true,
        },
      },
    },
  })

  let topped = 0
  let created = 0
  let poolEmpty = 0
  let skipped: { sessionId: string; reason: string }[] = []

  for (const session of sessions) {
    const metaAdAccountId = session.metaAdAccount?.id ?? null
    const adAccountId = session.metaAdAccount?.adAccountId

    if (!metaAdAccountId || !adAccountId) continue

    // ★ Write gate: ownership + token check (fail-closed)
    const writeCheck = await canWriteToAdAccount(session.userId, metaAdAccountId)
    if (!writeCheck.ok) {
      skipped.push({ sessionId: session.id, reason: writeCheck.reason! })
      await prisma.campaignSession.update({
        where: { id: session.id },
        data: { nextMonitorAt: new Date(now.getTime() + 15 * 60 * 1000) },
      })
      continue
    }

    const token = writeCheck.token!

    try {
      // Mark account healthy
      await markAccountHealthy(metaAdAccountId)

      // Count active ads (from MetaEntity)
      const activeAds = await prisma.metaEntity.count({
        where: { campaignSessionId: session.id, entityType: 'AD', effectiveStatus: 'ACTIVE' },
      })

      // ★ Inflight guard: count PENDING CREATE_AD
      const inflightCreateAd = await prisma.automationAction.count({
        where: { campaignSessionId: session.id, actionType: 'CREATE_AD', status: 'PENDING' },
      })

      const need = Math.max(0, session.minActiveAds - activeAds - inflightCreateAd)
      if (need <= 0) continue

      topped++

      // Claim and create ads directly
      let sessionCreated = 0
      let sessionPoolEmpty = false

      for (let i = 0; i < need; i++) {
        // Atomic claim
        const poolItem = await prisma.campaignCreativePool.findFirst({
          where: { campaignSessionId: session.id, status: 'available' },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, primaryText: true, headline: true, description: true, callToAction: true, linkUrl: true, mediaAssetId: true, creativeUrl: true },
        })

        if (!poolItem) {
          sessionPoolEmpty = true
          break
        }

        const claimResult = await prisma.campaignCreativePool.updateMany({
          where: { id: poolItem.id, status: 'available' },
          data: { status: 'used', usedAt: new Date() },
        })

        if (claimResult.count === 0) {
          i--
          continue
        }

        // Create ad via Meta API (PAUSED)
        try {
          const adAccountIdNum = adAccountId.replace(/^act_/, '')
          const pageId = await resolvePageId(adAccountIdNum, token, {
            sessionId: session.id,
            metaAdAccountId: metaAdAccountId,
          })
          const adResult = await createAd({
            adAccountId: adAccountIdNum,
            pageId,
            name: `Topup-${poolItem.headline?.slice(0, 30) ?? 'Ad'}-${Date.now()}`,
            adsetId: session.topupTargetAdsetId ?? '',
            primaryText: poolItem.primaryText,
            headline: poolItem.headline ?? '',
            description: poolItem.description ?? '',
            callToAction: poolItem.callToAction ?? 'LEARN_MORE',
            linkUrl: poolItem.linkUrl ?? '',
            mediaUrl: await resolvePoolMediaUrl(poolItem),
            status: 'PAUSED',
          }, token)

          // Update pool with Meta ad ID
          await prisma.campaignCreativePool.update({
            where: { id: poolItem.id },
            data: { usedMetaAdId: adResult.adId },
          })

          // Create topup log
          await prisma.campaignTopupLog.create({
            data: {
              campaignSessionId: session.id,
              activeAdsBefore: activeAds,
              minActiveAds: session.minActiveAds,
              poolCreativeId: poolItem.id,
              status: 'succeeded',
              note: `Ad ${adResult.adId} created PAUSED`,
              triggeredAt: now,
            },
          })

          // Create AutomationAction
          await prisma.automationAction.create({
            data: {
              userId: session.userId,
              campaignSessionId: session.id,
              source: 'SYSTEM',
              actionType: 'CREATE_AD',
              payloadJson: JSON.stringify({ adId: adResult.adId, creativeId: adResult.creativeId, poolCreativeId: poolItem.id }),
              status: 'SUCCEEDED',
              idempotencyKey: `topup_cron_${session.id}_${poolItem.id}`,
              priority: 3,
              requestedAt: now,
              executedAt: now,
              confirmedAt: now,
            },
          })

          sessionCreated++

          // Notify topup created
          await notify(session.userId, {
            type: 'topup_created',
            severity: 'success',
            title: 'Ad baru ditambahkan',
            body: `Ad ${adResult.adId} dibuat (PAUSED) untuk top-up campaign.`,
            refType: 'campaign_session',
            refId: session.id,
          }).catch(() => {})
        } catch (adErr) {
          console.error(`[topup-campaigns] createAd failed for pool ${poolItem.id}:`, adErr)

          // Handle TokenError → mark account needs_reconnect
          if (adErr instanceof TokenError) {
            await markAccountNeedsReconnect(metaAdAccountId)
          }

          const isTransient = (adErr as Error).message.includes('rate') || (adErr as Error).message.includes('timeout')
          await prisma.campaignCreativePool.update({
            where: { id: poolItem.id },
            data: { status: isTransient ? 'available' : 'failed' },
          })

          await prisma.campaignTopupLog.create({
            data: {
              campaignSessionId: session.id,
              activeAdsBefore: activeAds,
              minActiveAds: session.minActiveAds,
              poolCreativeId: poolItem.id,
              status: 'failed',
              note: String(adErr).slice(0, 500),
              triggeredAt: now,
            },
          })
        }
      }

      created += sessionCreated
      if (sessionPoolEmpty) {
        poolEmpty++
        const lastNotify = await prisma.campaignTopupLog.findFirst({
          where: { campaignSessionId: session.id, status: 'skipped_empty_pool', triggeredAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
          orderBy: { triggeredAt: 'desc' },
        })
        if (!lastNotify) {
          await prisma.automationAction.create({
            data: {
              userId: session.userId,
              campaignSessionId: session.id,
              source: 'SYSTEM',
              actionType: 'NOTIFY',
              payloadJson: JSON.stringify({ kind: 'pool_exhausted', campaignSessionId: session.id }),
              status: 'SUCCEEDED',
              idempotencyKey: `topup_notify_${session.id}_${now.getTime()}`,
              priority: 5,
              requestedAt: now,
              executedAt: now,
            },
          })
          await prisma.campaignTopupLog.create({
            data: { campaignSessionId: session.id, activeAdsBefore: activeAds, minActiveAds: session.minActiveAds, status: 'skipped_empty_pool', note: 'Pool exhausted during cron top-up', triggeredAt: now },
          })
          await notify(session.userId, {
            type: 'pool_exhausted',
            severity: 'warning',
            title: 'Stok creative habis',
            body: `Tidak ada creative tersisa di pool untuk top-up campaign. Tambahkan creative baru.`,
            refType: 'campaign_session',
            refId: session.id,
          }).catch(() => {})
        }
      }

      // Update nextMonitorAt dengan monitorIntervalMinutes
      const interval = session.monitorIntervalMinutes ?? 5
      await prisma.campaignSession.update({
        where: { id: session.id },
        data: { nextMonitorAt: new Date(now.getTime() + interval * 60 * 1000) },
      })
    } catch (err) {
      if (err instanceof TokenError) {
        console.warn(`[topup-campaigns] TokenError for session ${session.id}:`, (err as Error).message)
        await markAccountNeedsReconnect(metaAdAccountId)
      } else {
        console.error(`[topup-campaigns] Session ${session.id} error:`, err)
      }
      await prisma.campaignSession.update({
        where: { id: session.id },
        data: { nextMonitorAt: new Date(now.getTime() + 15 * 60 * 1000) },
      })
    }
  }

  return { topped, created, poolEmpty, skipped: skipped.length }
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    console.warn('[topup-campaigns] Unauthorized')
    return NextResponse.json({ ok: false, error: 'Unauthorized', ts: new Date().toISOString() })
  }
  try {
    const result = await run()
    return NextResponse.json({ ok: true, ...result, ts: new Date().toISOString() })
  } catch (err) {
    console.error('[topup-campaigns] Error:', err)
    return NextResponse.json({ ok: false, error: 'Internal error', ts: new Date().toISOString() })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
