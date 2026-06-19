import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateApiKey, unauthorizedResponse } from '../../../_lib/api-key-auth'

export const runtime = 'nodejs'

/**
 * GET /api/internal/monitor/sessions/[id]/rules
 * Fetch ACTIVE rules for a session — called by worker during scan.
 * Returns rules with conditionTreeJson + actionSpecJson for evaluation.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!validateApiKey(req)) {
    return unauthorizedResponse()
  }

  const sessionId = params.id

  // Verify session exists
  const session = await prisma.campaignSession.findUnique({
    where: { id: sessionId },
    select: { id: true, automationEnabled: true, status: true },
  })
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const rules = await prisma.automationRule.findMany({
    where: {
      campaignSessionId: sessionId,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      name: true,
      scope: true,
      ruleCategory: true,
      conditionTreeJson: true,
      actionSpecJson: true,
      evaluationWindowMinutes: true,
      minimumDataAgeMinutes: true,
      cooldownMinutes: true,
      priority: true,
      maxFireCount: true,
      lastFiredAt: true,
      fireCount: true,
      createdAt: true,
    },
    orderBy: { priority: 'asc' },
  })

  return NextResponse.json({
    sessionId,
    automationEnabled: session.automationEnabled,
    rules,
  })
}

/**
 * PATCH /api/internal/monitor/sessions/[id]
 * Update monitor cadence after a scan cycle.
 * Body: { lastMonitorAt, nextMonitorAt }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!validateApiKey(req)) {
    return unauthorizedResponse()
  }

  let body: {
    lastMonitorAt?: string
    nextMonitorAt?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const sessionId = params.id

  const updateData: Record<string, unknown> = {}

  if (body.lastMonitorAt) {
    updateData.lastMonitorAt = new Date(body.lastMonitorAt)
  }
  if (body.nextMonitorAt) {
    updateData.nextMonitorAt = new Date(body.nextMonitorAt)
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'At least one of lastMonitorAt or nextMonitorAt is required' }, { status: 400 })
  }

  try {
    await prisma.campaignSession.update({
      where: { id: sessionId },
      data: updateData,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[internal/monitor/sessions/[id]] Error:', message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
