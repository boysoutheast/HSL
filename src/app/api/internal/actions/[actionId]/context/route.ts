import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateApiKey, unauthorizedResponse } from '../../../_lib/api-key-auth'

export const runtime = 'nodejs'

/**
 * GET /api/internal/actions/[actionId]/context
 * Returns action + campaign session data for worker (no tokens!).
 * Query params: includeMetrics (boolean)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { actionId: string } }
) {
  if (!validateApiKey(req)) {
    return unauthorizedResponse()
  }

  const { searchParams } = new URL(req.url)
  const includeMetrics = searchParams.get('includeMetrics') === 'true'

  try {
    const action = await prisma.automationAction.findUnique({
      where: { id: params.actionId },
      include: {
        campaignSession: {
          select: {
            id: true,
            name: true,
            status: true,
            phase: true,
            objective: true,
            dailyBudget: true,
            currency: true,
            timezone: true,
            automationEnabled: true,
            metaAdAccountId: true,
            productId: true,
            testLaunchId: true,
            lastMonitorAt: true,
            lastActionAt: true,
            nextMonitorAt: true,
          },
        },
        ruleExecution: {
          select: {
            id: true,
            ruleId: true,
            matched: true,
            reasonText: true,
            evaluatedAt: true,
            conditionResultJson: true,
          },
        },
      },
    })

    if (!action) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 })
    }

    // Get related meta entities if campaign session exists
    let metaEntities: unknown[] = []
    if (action.campaignSession?.id && includeMetrics) {
      metaEntities = await prisma.metaEntity.findMany({
        where: { campaignSessionId: action.campaignSession.id },
        select: {
          id: true,
          entityType: true,
          metaEntityId: true,
          name: true,
          effectiveStatus: true,
          deliveryStatus: true,
          configuredStatus: true,
          lastSyncedAt: true,
        },
      })
    }

    // Get recent metric snapshots for the campaign session
    let recentMetrics: unknown[] = []
    if (action.campaignSession?.id && includeMetrics) {
      recentMetrics = await prisma.metricSnapshot.findMany({
        where: { campaignSessionId: action.campaignSession.id },
        orderBy: { windowEnd: 'desc' },
        take: 10,
      })
    }

    // Parse JSON fields
    let payload: unknown = null
    let precondition: unknown = null
    try {
      if (action.payloadJson) payload = JSON.parse(action.payloadJson)
    } catch { /* ignore */ }
    try {
      if (action.preconditionJson) precondition = JSON.parse(action.preconditionJson)
    } catch { /* ignore */ }

    return NextResponse.json({
      action: {
        ...action,
        payloadJson: undefined,
        preconditionJson: undefined,
        payload,
        precondition,
      },
      campaignSession: action.campaignSession,
      metaEntities,
      recentMetrics,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Failed to get action context', message }, { status: 500 })
  }
}
