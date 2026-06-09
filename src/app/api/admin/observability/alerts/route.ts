import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import type { InputJsonValue } from '@prisma/client/runtime/library'

export const dynamic = 'force-dynamic'

// Default alert configurations
const DEFAULT_ALERTS = [
  {
    key: 'alert_p0_latency',
    name: 'P0 Task Latency',
    description: 'Alert when oldest P0 task exceeds threshold',
    threshold: 10,
    unit: 'seconds',
    channel: 'log',
    enabled: true,
  },
  {
    key: 'alert_uncertain_count',
    name: 'UNCERTAIN Actions',
    description: 'Alert when UNCERTAIN action count exceeds threshold in 24h',
    threshold: 5,
    unit: 'count',
    channel: 'log',
    enabled: true,
  },
  {
    key: 'alert_dead_letter',
    name: 'Dead Letter Queue',
    description: 'Alert when any task reaches dead letter state (max attempts exceeded)',
    threshold: 0,
    unit: 'count',
    channel: 'log',
    enabled: true,
  },
  {
    key: 'alert_meta_error_rate',
    name: 'Meta API Error Rate',
    description: 'Alert when Meta API error rate exceeds threshold in 24h',
    threshold: 10,
    unit: 'percent',
    channel: 'log',
    enabled: true,
  },
]

// GET /api/admin/observability/alerts
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const flags = await prisma.featureFlag.findMany({
    where: { key: { startsWith: 'alert_' } },
    orderBy: { key: 'asc' },
  })

  const flagMap: Record<string, { enabled: boolean; config: Record<string, unknown> }> = {}
  for (const f of flags) {
    flagMap[f.key] = { enabled: f.enabled, config: (f.config as Record<string, unknown>) ?? {} }
  }

  const alerts = DEFAULT_ALERTS.map(a => {
    const stored = flagMap[a.key]
    return {
      ...a,
      enabled: stored?.enabled ?? a.enabled,
      threshold: (stored?.config?.threshold as number) ?? a.threshold,
      channel: (stored?.config?.channel as string) ?? a.channel,
    }
  })

  return NextResponse.json({ alerts })
}

// PATCH /api/admin/observability/alerts
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  let body: { key: string; enabled?: boolean; threshold?: number; channel?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.key) {
    return NextResponse.json({ error: 'key is required' }, { status: 400 })
  }

  const defaultAlert = DEFAULT_ALERTS.find(a => a.key === body.key)
  if (!defaultAlert) {
    return NextResponse.json({ error: 'Unknown alert key' }, { status: 404 })
  }

  const config: Record<string, unknown> = {
    threshold: body.threshold ?? defaultAlert.threshold,
    channel: body.channel ?? defaultAlert.channel,
  }

  await prisma.featureFlag.upsert({
    where: { key: body.key },
    create: {
      key: body.key,
      name: defaultAlert.name,
      description: defaultAlert.description,
      enabled: body.enabled ?? defaultAlert.enabled,
      scope: 'global',
      config: config as InputJsonValue,
    },
    update: {
      enabled: body.enabled,
      config: config as InputJsonValue,
    },
  })

  return NextResponse.json({ success: true })
}
