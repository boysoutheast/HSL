/**
 * POST /api/cron/topup-campaigns
 * Batched cron: evaluate floor, atomic claim pool, create ad via Meta API.
 * Pertahankan inflight guard (MVP2).
 * Allowlist guard: HSL_WRITE_ALLOWED_AD_ACCOUNTS env.
 * Schedule: every 10 minutes
 * Auth: x-cron-secret (CRON_SECRET env)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAd, resolvePageId, TokenError, RateLimitError } from '@/lib/meta-client'

export const dynamic = 'force-dynamic'

const LIMIT = 30

function checkAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('x-cron-secret') === secret
    || req.headers.get('authorization') === `Bearer ${secret}`
}

function decryptToken(encrypted: string): string {
  const crypto = require('crypto')
  const key = process.env.ENCRYPTION_KEY
  if (!key) throw new Error('ENCRYPTION_KEY not set')
  const parts = encrypted.split(':')
  const iv = Buffer.from(parts[0], 'hex')
  const enc = Buffer.from(parts[1], 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key.padEnd(32, 'x').slice(0, 32)), iv)
  return decipher.update(enc, undefined, 'utf8') + decipher.final('utf8')
}

function isAllowed(adAccountId: string): boolean {
  const allowlist = (process.env.HSL_WRITE_ALLOWED_AD_ACCOUNTS ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (allowlist.length === 0) return true
  const numericId = adAccountId.replace(/^act_/, '')
  return allowlist.some(a => a === numericId || a === adAccountId)
}

async function run() {
  const now = new Date()

  const sessions = await prisma.campaignSession.findMany({
    where: {
      topupEnabled: true,
      minActiveAds: { gt: 0 },
    },
    take: LIMIT,
    orderBy: { lastMonitorAt: { sort: 'asc', nulls: 'first' } },
    select: {
      id: true,
      userId: true,
      minActiveAds: true,
      topupTargetAdsetId: true,
      metaAdAccountId: true,
      metaAdAccount: {
        select: {
          adAccountId: true,
          metaAccount: { select: { longLivedTokenEncrypted: true } },
        },
      },
    },
  })

  let topped = 0
  let created = 0
  let poolEmpty = 0

  for (const session of sessions) {
    const encryptedToken = session.metaAdAccount?.metaAccount?.longLivedTokenEncrypted
    const adAccountId = session.metaAdAccount?.adAccountId

    if (!encryptedToken || !adAccountId) continue
    if (!isAllowed(adAccountId)) {
      console.warn(`[topup-campaigns] Skip ${adAccountId} — not in allowlist`)
      continue
    }

    try {
      const token = decryptToken(encryptedToken)

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
            metaAdAccountId: session.metaAdAccountId ?? undefined,
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
            mediaUrl: poolItem.creativeUrl ?? undefined,
            status: 'PAUSED',
          }, token)

          // Update pool with Meta ad ID
          await prisma.campaignCreativePool.update({
            where: { id: poolItem.id },
            data: { usedMetaAdId: adResult.adId },
          })

          // Create topup log (succeeded)
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
              payloadJson: JSON.stringify({
                adId: adResult.adId,
                creativeId: adResult.creativeId,
                poolCreativeId: poolItem.id,
              }),
              status: 'SUCCEEDED',
              idempotencyKey: `topup_cron_${session.id}_${poolItem.id}`,
              priority: 3,
              requestedAt: now,
              executedAt: now,
              confirmedAt: now,
            },
          })

          sessionCreated++
        } catch (adErr) {
          console.error(`[topup-campaigns] createAd failed for pool ${poolItem.id}:`, adErr)

          // Return pool item to available (transient error) or mark failed
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
        // NOTIFY via AutomationAction (cooldown 60m)
        const lastNotify = await prisma.campaignTopupLog.findFirst({
          where: {
            campaignSessionId: session.id,
            status: 'skipped_empty_pool',
            triggeredAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
          },
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
            data: {
              campaignSessionId: session.id,
              activeAdsBefore: activeAds,
              minActiveAds: session.minActiveAds,
              status: 'skipped_empty_pool',
              note: 'Pool exhausted during cron top-up',
              triggeredAt: now,
            },
          })
        }
      }

      // Update lastMonitorAt
      await prisma.campaignSession.update({
        where: { id: session.id },
        data: { lastMonitorAt: now },
      })
    } catch (err) {
      console.error(`[topup-campaigns] Session ${session.id} error:`, err)
    }
  }

  return { topped, created, poolEmpty }
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
    return NextResponse.json({ ok: false, error: String(err), ts: new Date().toISOString() })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
