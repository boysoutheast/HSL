import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const session = await prisma.campaignSession.findFirst({
    where: { id: params.id, userId: auth.id },
    include: {
      metaAdAccount: { select: { id: true, adAccountId: true, adAccountName: true } },
      metaEntities: { orderBy: { entityType: 'asc' } },
      automationRules: { select: { id: true } },
      automationActions: { orderBy: { requestedAt: 'desc' }, take: 10 },
    },
  })

  if (!session) {
    return NextResponse.json({ error: 'Campaign session not found' }, { status: 404 })
  }

  const latestSnapshot = await prisma.metricSnapshot.findFirst({
    where: { campaignSessionId: params.id, entityType: 'CAMPAIGN' },
    orderBy: { windowEnd: 'desc' },
  })

  return NextResponse.json({
    session: {
      ...session,
      automationRulesCount: session.automationRules.length,
      latestSnapshot,
    },
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    status?: string
    phase?: string
    automationEnabled?: boolean
    monitorIntervalMinutes?: number
    // MVP2: floor + topup
    minActiveAds?: number
    topupEnabled?: boolean
    topupTargetAdsetId?: string | null
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const existing = await prisma.campaignSession.findFirst({
    where: { id: params.id, userId: auth.id },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Campaign session not found' }, { status: 404 })
  }

  // Guard: automationEnabled=true only if session has ≥1 ACTIVE AutomationRule
  if (body.automationEnabled === true) {
    const activeRuleCount = await prisma.automationRule.count({
      where: {
        campaignSessionId: params.id,
        status: 'ACTIVE',
      },
    })
    if (activeRuleCount === 0) {
      return NextResponse.json({
        error: 'Cannot enable automation. Attach at least 1 rule first.',
      }, { status: 422 })
    }
  }

  // Guard: monitorIntervalMinutes valid range 5–1440
  if (body.monitorIntervalMinutes !== undefined) {
    if (body.monitorIntervalMinutes < 5 || body.monitorIntervalMinutes > 1440) {
      return NextResponse.json({
        error: 'monitorIntervalMinutes must be between 5 and 1440',
      }, { status: 400 })
    }
  }

  // Guard: minActiveAds range 0–50
  if (body.minActiveAds !== undefined) {
    if (body.minActiveAds < 0 || body.minActiveAds > 50) {
      return NextResponse.json({ error: 'minActiveAds must be between 0 and 50' }, { status: 400 })
    }
  }

  // Guard: topupEnabled=true requires minActiveAds > 0 AND ≥1 available pool creative
  if (body.topupEnabled === true) {
    const sessionCheck = await prisma.campaignSession.findFirst({
      where: { id: params.id, userId: auth.id },
      select: { minActiveAds: true },
    })
    const currentMinAds = body.minActiveAds ?? sessionCheck?.minActiveAds ?? 0
    if (currentMinAds <= 0) {
      return NextResponse.json({ error: 'Set minActiveAds > 0 before enabling top-up' }, { status: 422 })
    }
    const availableCount = await prisma.campaignCreativePool.count({
      where: { campaignSessionId: params.id, status: 'available' },
    })
    if (availableCount === 0) {
      return NextResponse.json({ error: 'Add at least 1 available creative to the pool before enabling top-up' }, { status: 422 })
    }
  }

  const updateData: Record<string, unknown> = {}
  if (body.status !== undefined) updateData.status = body.status
  if (body.phase !== undefined) updateData.phase = body.phase
  if (body.automationEnabled !== undefined) updateData.automationEnabled = body.automationEnabled
  if (body.monitorIntervalMinutes !== undefined) {
    updateData.monitorIntervalMinutes = body.monitorIntervalMinutes
    updateData.nextMonitorAt = new Date() // reset so scan fires next cycle
  }
  if (body.minActiveAds !== undefined) updateData.minActiveAds = body.minActiveAds
  if (body.topupEnabled !== undefined) updateData.topupEnabled = body.topupEnabled
  if (body.topupTargetAdsetId !== undefined) updateData.topupTargetAdsetId = body.topupTargetAdsetId

  const session = await prisma.campaignSession.update({
    where: { id: params.id },
    data: updateData,
  })

  return NextResponse.json({ session })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const existing = await prisma.campaignSession.findFirst({
    where: { id: params.id, userId: auth.id },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Campaign session not found' }, { status: 404 })
  }

  const session = await prisma.campaignSession.update({
    where: { id: params.id },
    data: { status: 'KILLED' },
  })

  return NextResponse.json({ session })
}
