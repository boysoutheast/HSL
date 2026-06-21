import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateApiKey } from '../../_lib/api-key-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (!validateApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 50)

  // Fetch sessions that are RUNNING with automation enabled and due for monitoring
  const now = new Date()
  const sessions = await prisma.campaignSession.findMany({
    where: {
      status: 'RUNNING',
      automationEnabled: true,
      metaAdAccountId: { not: null },
      OR: [{ nextMonitorAt: { lte: now } }, { nextMonitorAt: null }],
    },
    select: {
      id: true,
      name: true,
      userId: true,
      metaAdAccountId: true,
      monitorIntervalMinutes: true,
      minActiveAds: true,
      topupEnabled: true,
      topupTargetAdsetId: true,
      metaAdAccount: {
        select: {
          id: true,
          adAccountId: true,
          metaAccount: {
            select: { id: true },
          },
        },
      },
      metaEntities: {
        where: { entityType: { in: ['CAMPAIGN', 'ADSET', 'AD'] } },
        select: {
          id: true,
          entityType: true,
          metaEntityId: true,
        },
      },
    },
    orderBy: { nextMonitorAt: 'asc' },
    take: limit,
  })

  // Return metaAccountId so worker can fetch token via /api/worker/tokens/{metaAccountId}
  const result = sessions.map((s) => ({
    id: s.id,
    name: s.name,
    userId: s.userId,
    metaAdAccountId: s.metaAdAccountId,
    metaAccountId: s.metaAdAccount?.metaAccount?.id ?? null,
    adAccountId: s.metaAdAccount?.adAccountId ?? null,
    monitorIntervalMinutes: s.monitorIntervalMinutes,
    metaEntities: s.metaEntities.map((e) => ({
      id: e.id,
      entityType: e.entityType,
      metaEntityId: e.metaEntityId,
    })),
  }))

  return NextResponse.json({ sessions: result })
}
