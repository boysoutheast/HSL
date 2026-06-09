import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateApiKey, unauthorizedResponse } from '../../_lib/api-key-auth'
import { v4 as uuidv4 } from 'uuid'

export const runtime = 'nodejs'

/**
 * POST /api/internal/rules/actions
 * Creates an AutomationAction triggered by a rule evaluation.
 * Worker-callable only (x-api-key auth).
 * Input: { ruleId, ruleExecutionId?, campaignSessionId, actionType, targetEntityType?, payloadJson?, priority? }
 */
export async function POST(req: NextRequest) {
  if (!validateApiKey(req)) {
    return unauthorizedResponse()
  }

  let body: {
    ruleId: string
    ruleExecutionId?: string
    campaignSessionId: string
    actionType: string
    targetEntityType?: string
    targetMetaEntityId?: string
    payloadJson?: Record<string, unknown>
    priority?: number
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.ruleId) {
    return NextResponse.json({ error: 'ruleId is required' }, { status: 400 })
  }
  if (!body.campaignSessionId) {
    return NextResponse.json({ error: 'campaignSessionId is required' }, { status: 400 })
  }
  if (!body.actionType) {
    return NextResponse.json({ error: 'actionType is required' }, { status: 400 })
  }

  try {
    // Fetch the rule to get userId
    const rule = await prisma.automationRule.findUnique({
      where: { id: body.ruleId },
      select: { userId: true },
    })

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    const idempotencyKey = uuidv4()
    const payload = body.payloadJson ?? {}

    const action = await prisma.automationAction.create({
      data: {
        userId: rule.userId,
        campaignSessionId: body.campaignSessionId,
        ruleExecutionId: body.ruleExecutionId ?? null,
        source: 'RULE',
        actionType: body.actionType,
        targetEntityType: body.targetEntityType ?? null,
        targetMetaEntityId: body.targetMetaEntityId ?? null,
        payloadJson: JSON.stringify(payload),
        status: 'PENDING',
        idempotencyKey,
        priority: body.priority ?? 5,
        requestedAt: new Date(),
      },
    })

    return NextResponse.json({ action }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Failed to create rule action', message }, { status: 500 })
  }
}
