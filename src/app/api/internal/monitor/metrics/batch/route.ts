import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface MetricInput {
  campaignSessionId: string
  entityType: string
  metaEntityId: string
  windowEnd: string
  spend: number
  impressions: number
  clicks: number
  leads?: number | null
  purchases?: number | null
  purchaseValue?: number | null
  roas?: number | null
  cpc?: number | null
  ctr?: number | null
}

async function validateApiKey(req: NextRequest): Promise<boolean> {
  const apiKey = req.headers.get('x-api-key')
  return apiKey === process.env.WORKER_API_KEY
}

export async function POST(req: NextRequest) {
  if (!(await validateApiKey(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: MetricInput[]
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!Array.isArray(body) || body.length === 0) {
    return NextResponse.json({ error: 'Expected non-empty array of metrics' }, { status: 400 })
  }

  const sessionIds = [...new Set(body.map((m) => m.campaignSessionId))]

  // Bulk upsert via raw SQL — more reliable for high-volume upserts than Prisma's upsert
  const values = body
    .map((m) => {
      const windowEnd = new Date(m.windowEnd).toISOString()
      const windowStart = new Date(new Date(m.windowEnd).getTime() - 24 * 60 * 60 * 1000).toISOString()
      return `(
        '${m.campaignSessionId}',
        '${m.metaEntityId}',
        '${m.entityType}',
        '${windowStart}',
        '${windowEnd}',
        '7d',
        ${m.spend},
        ${m.impressions},
        ${m.clicks},
        ${m.leads ?? 0},
        ${m.purchases ?? 0},
        ${m.purchaseValue ?? 0},
        ${m.roas ?? 'NULL'},
        ${m.cpc ?? 'NULL'},
        ${m.ctr ?? 'NULL'}
      )`
    })
    .join(',\n')

  const upsertSql = `
    INSERT INTO metric_snapshots (
      campaign_session_id, meta_entity_id, entity_type,
      window_start, window_end, attribution_window,
      spend, impressions, clicks, leads, purchases, purchase_value,
      roas, cpc, ctr
    )
    VALUES ${values}
    ON CONFLICT (campaign_session_id, meta_entity_id, window_end)
    DO UPDATE SET
      entity_type = EXCLUDED.entity_type,
      spend = EXCLUDED.spend,
      impressions = EXCLUDED.impressions,
      clicks = EXCLUDED.clicks,
      leads = EXCLUDED.leads,
      purchases = EXCLUDED.purchases,
      purchase_value = EXCLUDED.purchase_value,
      roas = EXCLUDED.roas,
      cpc = EXCLUDED.cpc,
      ctr = EXCLUDED.ctr
  `

  await prisma.$executeRawUnsafe(upsertSql)

  // Update CampaignSession.lastMonitorAt and nextMonitorAt for all affected sessions
  const now = new Date()
  await Promise.all(
    sessionIds.map(async (sessionId) => {
      const session = await prisma.campaignSession.findUnique({
        where: { id: sessionId },
        select: { monitorIntervalMinutes: true },
      })
      const intervalMinutes = session?.monitorIntervalMinutes ?? 15
      const nextMonitorAt = new Date(now.getTime() + intervalMinutes * 60 * 1000)
      await prisma.campaignSession.update({
        where: { id: sessionId },
        data: { lastMonitorAt: now, nextMonitorAt },
      })
    })
  )

  return NextResponse.json({ written: body.length }, { status: 201 })
}
