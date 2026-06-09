import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateApiKey, unauthorizedResponse } from '../../_lib/api-key-auth'

export const runtime = 'nodejs'

/**
 * POST /api/internal/rules/executions
 * Creates a RuleExecution record (written by the rules worker).
 * Input: { ruleId, ruleVersion, campaignSessionId, matched, conditionResultJson, reasonText, deduplicationKey, targetMetaEntityId? }
 */
export async function POST(req: NextRequest) {
  if (!validateApiKey(req)) {
    return unauthorizedResponse()
  }

  let body: {
    ruleId: string
    ruleVersion?: number
    campaignSessionId: string
    matched: boolean
    conditionResultJson?: string
    reasonText?: string
    deduplicationKey?: string
    targetMetaEntityId?: string
    actionCreatedId?: string
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

  try {
    const evaluatedAt = new Date()
    const deduplicationKey = body.deduplicationKey || `${body.ruleId}:${evaluatedAt.toISOString()}`

    const execution = await prisma.ruleExecution.create({
      data: {
        ruleId: body.ruleId,
        ruleVersion: body.ruleVersion ?? 1,
        campaignSessionId: body.campaignSessionId,
        targetMetaEntityId: body.targetMetaEntityId ?? null,
        evaluatedAt,
        matched: body.matched,
        conditionResultJson: body.conditionResultJson ?? '{}',
        reasonText: body.reasonText ?? null,
        actionCreatedId: body.actionCreatedId ?? null,
        deduplicationKey,
      },
    })

    return NextResponse.json({ execution }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // Handle unique constraint violation on deduplicationKey gracefully
    if (message.includes('Unique constraint') || message.includes('duplicate key')) {
      return NextResponse.json({ error: 'Duplicate execution (deduplicationKey collision)', message }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create rule execution', message }, { status: 500 })
  }
}
