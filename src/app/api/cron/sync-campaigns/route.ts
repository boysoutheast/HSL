/**
 * POST /api/cron/sync-campaigns
 * Batched cron: pick up imported sessions pending sync, fetch from Meta, upsert entities.
 * Schedule: every 5 minutes
 * Auth: x-cron-secret (CRON_SECRET env)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCampaignStructure, TokenError } from '@/lib/meta-client'
import { decode } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

const LIMIT = 20

function checkAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('x-cron-secret') === secret
    || req.headers.get('authorization') === `Bearer ${secret}`
}

async function run() {
  const sessions = await prisma.campaignSession.findMany({
    where: {
      source: 'imported',
      OR: [
        { importStatus: 'pending_sync' },
        { importStatus: null },
      ],
    },
    take: LIMIT,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      metaCampaignId: true,
      metaAdAccountId: true,
      userId: true,
      importStatus: true,
      metaAdAccount: {
        select: {
          adAccountId: true,
          metaAccount: {
            select: { longLivedTokenEncrypted: true },
          },
        },
      },
    },
  })

  let synced = 0
  let failed = 0

  for (const session of sessions) {
    const adAccountId = session.metaAdAccount?.adAccountId
    const encryptedToken = session.metaAdAccount?.metaAccount?.longLivedTokenEncrypted
    const metaCampaignId = session.metaCampaignId

    if (!adAccountId || !encryptedToken || !metaCampaignId) {
      await prisma.campaignSession.update({
        where: { id: session.id },
        data: { importStatus: 'sync_failed' },
      })
      failed++
      continue
    }

    try {
      // Decrypt token (simple decryption with ENCRYPTION_KEY)
      const token = decryptToken(encryptedToken)
      const structure = await getCampaignStructure(adAccountId, metaCampaignId, token)

      // Upsert campaign entity
      await prisma.metaEntity.upsert({
        where: {
          metaAdAccountId_entityType_metaEntityId: {
            metaAdAccountId: session.metaAdAccountId!,
            entityType: 'CAMPAIGN',
            metaEntityId: metaCampaignId,
          },
        },
        update: {
          name: structure.campaign.name ?? `Campaign ${metaCampaignId}`,
          effectiveStatus: structure.campaign.status ?? null,
          configuredStatus: structure.campaign.status ?? null,
          rawStateJson: JSON.stringify({
            dailyBudget: (structure.campaign as any).daily_budget ?? null,
            lifetimeBudget: (structure.campaign as any).lifetime_budget ?? null,
            budgetRemaining: (structure.campaign as any).budget_remaining ?? null,
          }),
          lastSyncedAt: new Date(),
        },
        create: {
          userId: session.userId,
          campaignSessionId: session.id,
          metaAdAccountId: session.metaAdAccountId!,
          entityType: 'CAMPAIGN',
          metaEntityId: metaCampaignId,
          name: structure.campaign.name ?? `Campaign ${metaCampaignId}`,
          effectiveStatus: structure.campaign.status ?? null,
          configuredStatus: structure.campaign.status ?? null,
          rawStateJson: JSON.stringify({
            dailyBudget: (structure.campaign as any).daily_budget ?? null,
            lifetimeBudget: (structure.campaign as any).lifetime_budget ?? null,
            budgetRemaining: (structure.campaign as any).budget_remaining ?? null,
          }),
          lastSyncedAt: new Date(),
        },
      })

      // Upsert adsets
      for (const as of structure.adsets) {
        await prisma.metaEntity.upsert({
          where: {
            metaAdAccountId_entityType_metaEntityId: {
              metaAdAccountId: session.metaAdAccountId!,
              entityType: 'ADSET',
              metaEntityId: as.id,
            },
          },
          update: {
            name: as.name ?? `AdSet ${as.id}`,
            effectiveStatus: as.status ?? null,
            configuredStatus: as.status ?? null,
            parentMetaEntityId: metaCampaignId,
            lastSyncedAt: new Date(),
          },
          create: {
            userId: session.userId,
            campaignSessionId: session.id,
            metaAdAccountId: session.metaAdAccountId!,
            entityType: 'ADSET',
            metaEntityId: as.id,
            name: as.name ?? `AdSet ${as.id}`,
            effectiveStatus: as.status ?? null,
            configuredStatus: as.status ?? null,
            parentMetaEntityId: metaCampaignId,
            lastSyncedAt: new Date(),
          },
        })
      }

      // Upsert ads
      for (const ad of structure.ads) {
        await prisma.metaEntity.upsert({
          where: {
            metaAdAccountId_entityType_metaEntityId: {
              metaAdAccountId: session.metaAdAccountId!,
              entityType: 'AD',
              metaEntityId: ad.id,
            },
          },
          update: {
            name: ad.name ?? `Ad ${ad.id}`,
            effectiveStatus: ad.status ?? null,
            configuredStatus: ad.status ?? null,
            lastSyncedAt: new Date(),
          },
          create: {
            userId: session.userId,
            campaignSessionId: session.id,
            metaAdAccountId: session.metaAdAccountId!,
            entityType: 'AD',
            metaEntityId: ad.id,
            name: ad.name ?? `Ad ${ad.id}`,
            effectiveStatus: ad.status ?? null,
            configuredStatus: ad.status ?? null,
            lastSyncedAt: new Date(),
          },
        })
      }

      // Update session budget + status + budget mode
      const campaignDailyBudget = Number((structure.campaign as any).daily_budget ?? 0)
      const isCBO = campaignDailyBudget > 0
      // For ABO: find first adset with daily_budget
      let primaryAdsetMetaId: string | null = null
      if (!isCBO && structure.adsets.length > 0) {
        const firstAdset = structure.adsets[0]
        primaryAdsetMetaId = firstAdset.id
      }
      await prisma.campaignSession.update({
        where: { id: session.id },
        data: {
          importStatus: 'synced',
          dailyBudget: campaignDailyBudget > 0 ? campaignDailyBudget : 0,
          budgetMode: isCBO ? 'CBO' : 'ABO',
          primaryAdsetMetaId: isCBO ? null : primaryAdsetMetaId,
        },
      })

      synced++
    } catch (err) {
      console.error(`[sync-campaigns] Failed for session ${session.id}:`, err)
      await prisma.campaignSession.update({
        where: { id: session.id },
        data: { importStatus: 'sync_failed' },
      })
      failed++
    }
  }

  return { synced, failed, total: sessions.length }
}

function decryptToken(encrypted: string): string {
  return decode(encrypted)
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    console.warn('[sync-campaigns] Unauthorized')
    return NextResponse.json({ ok: false, error: 'Unauthorized', ts: new Date().toISOString() })
  }
  try {
    const result = await run()
    return NextResponse.json({ ok: true, ...result, ts: new Date().toISOString() })
  } catch (err) {
    console.error('[sync-campaigns] Error:', err)
    return NextResponse.json({ ok: false, error: 'Internal error', ts: new Date().toISOString() })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
