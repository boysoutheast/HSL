import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateApiKey, unauthorizedResponse } from '../_lib/api-key-auth'

export const runtime = 'nodejs'

/**
 * GET /api/internal/actions
 * Lists automation actions with filters.
 * Query params: campaignSessionId, status, source, actionType, ruleExecutionId, limit, offset
 */
export async function GET(req: NextRequest) {
  if (!validateApiKey(req)) {
    return unauthorizedResponse()
  }

  const { searchParams } = new URL(req.url)
  const campaignSessionId = searchParams.get('campaignSessionId')
  const status = searchParams.get('status')
  const source = searchParams.get('source')
  const actionType = searchParams.get('actionType')
  const ruleExecutionId = searchParams.get('ruleExecutionId')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  const where: Record<string, unknown> = {}
  if (campaignSessionId) where.campaignSessionId = campaignSessionId
  if (status) where.status = status
  if (source) where.source = source
  if (actionType) where.actionType = actionType
  if (ruleExecutionId) where.ruleExecutionId = ruleExecutionId

  try {
    const [actions, total] = await Promise.all([
      prisma.automationAction.findMany({
        where,
        orderBy: [
          { priority: 'asc' },
          { requestedAt: 'desc' },
        ],
        take: limit,
        skip: offset,
        include: {
          campaignSession: {
            select: {
              id: true,
              name: true,
              status: true,
              phase: true,
            },
          },
          ruleExecution: {
            select: {
              id: true,
              ruleId: true,
              matched: true,
            },
          },
        },
      }),
      prisma.automationAction.count({ where }),
    ])

    // Parse JSON fields
    const actionsWithParsedJson = actions.map((action) => {
      let payload: unknown = null
      let precondition: unknown = null
      let metaResponse: unknown = null
      try {
        if (action.payloadJson) payload = JSON.parse(action.payloadJson)
      } catch { /* ignore */ }
      try {
        if (action.preconditionJson) precondition = JSON.parse(action.preconditionJson)
      } catch { /* ignore */ }
      try {
        if (action.metaResponseJson) metaResponse = JSON.parse(action.metaResponseJson)
      } catch { /* ignore */ }
      return {
        ...action,
        payload,
        precondition,
        metaResponse,
      }
    })

    return NextResponse.json({
      actions: actionsWithParsedJson,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + actions.length < total,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[actions/list] Error:', message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/**
 * POST /api/internal/actions
 * Creates a new automation action.
 * Input: { userId, campaignSessionId, ruleExecutionId?, source, actionType, targetEntityType?, targetMetaEntityId?, payload, preconditionJson?, priority, idempotencyKey }
 */
export async function POST(req: NextRequest) {
  if (!validateApiKey(req)) {
    return unauthorizedResponse()
  }

  let body: {
    userId: string
    campaignSessionId: string
    ruleExecutionId?: string
    source: string
    actionType: string
    targetEntityType?: string
    targetMetaEntityId?: string
    payload: Record<string, unknown>
    preconditionJson?: string
    priority?: number
    idempotencyKey: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    userId,
    campaignSessionId,
    ruleExecutionId,
    source,
    actionType,
    targetEntityType,
    targetMetaEntityId,
    payload,
    preconditionJson,
    priority = 5,
    idempotencyKey,
  } = body

  // Validation
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }
  if (!campaignSessionId) {
    return NextResponse.json({ error: 'campaignSessionId is required' }, { status: 400 })
  }
  if (!source) {
    return NextResponse.json({ error: 'source is required' }, { status: 400 })
  }
  if (!actionType) {
    return NextResponse.json({ error: 'actionType is required' }, { status: 400 })
  }
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'idempotencyKey is required' }, { status: 400 })
  }
  if (!payload) {
    return NextResponse.json({ error: 'payload is required' }, { status: 400 })
  }

  try {
    // Check for existing action with same idempotency key
    const existing = await prisma.automationAction.findUnique({
      where: { idempotencyKey },
    })

    if (existing) {
      return NextResponse.json({
        action: existing,
        created: false,
        message: 'Action with this idempotency key already exists',
      })
    }

    const payloadJson = typeof payload === 'string' ? payload : JSON.stringify(payload)
    const requestedAt = new Date()

    const action = await prisma.automationAction.create({
      data: {
        userId,
        campaignSessionId,
        ruleExecutionId,
        source,
        actionType,
        targetEntityType,
        targetMetaEntityId,
        payloadJson,
        preconditionJson,
        priority,
        idempotencyKey,
        status: 'PENDING',
        requestedAt,
      },
    })

    return NextResponse.json({ action, created: true }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[actions/create] Error:', message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
