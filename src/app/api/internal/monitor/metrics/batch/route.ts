import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateApiKey } from '../../../_lib/api-key-auth'

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

export async function POST(req: NextRequest) {
  if (!validateApiKey(req)) {
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

  if (body.length > 500) {
    return NextResponse.json({ error: 'Max 500 metrics per batch' }, { status: 400 })
  }

  const sessionIds = [...new Set(body.map((m) => m.campaignSessionId))]

  // Per-row parameterized upsert — safe from SQL injection
  for (const m of body) {
    const windowEnd = new Date(m.windowEnd)
    if (isNaN(windowEnd.getTime())) {
      return NextResponse.json({ error: 'Invalid windowEnd date' }, { status: 400 })
    }
    const windowEndISO = windowEnd.toISOString()
    const windowStart = new Date(windowEnd.getTime() - 24 * 60 * 60 * 1000).toISOString()

    await prisma.$executeRaw`
      INSERT INTO metric_snapshots (
        campaign_session_id, meta_entity_id, entity_type,
        window_start, window_end, attribution_window,
        spend, impressions, clicks, leads, purchases, purchase_value,
        roas, cpc, ctr
      )
      VALUES (
        ${m.campaignSessionId}, ${m.metaEntityId}, ${m.entityType},
        ${windowStart},
        ${windowEndISO},
        ${'7d'},
        ${m.spend}, ${m.impressions}, ${m.clicks},
        ${m.leads ?? 0}, ${m.purchases ?? 0}, ${m.purchaseValue ?? 0},
        ${m.roas ?? null}, ${m.cpc ?? null}, ${m.ctr ?? null}
      )
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
  }

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
