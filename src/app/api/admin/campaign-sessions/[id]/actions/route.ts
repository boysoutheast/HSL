import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/admin/campaign-sessions/[id]/actions
 * List AutomationActions for a specific campaign session, sorted by requestedAt desc.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const sessionId = params.id

  // Verify the session belongs to the user
  const session = await prisma.campaignSession.findFirst({
    where: { id: sessionId, userId: auth.id },
    select: { id: true },
  })

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const actions = await prisma.automationAction.findMany({
    where: { campaignSessionId: sessionId },
    orderBy: { requestedAt: 'desc' },
  })

  return NextResponse.json({ actions })
}

/**
 * POST /api/admin/campaign-sessions/[id]/actions
 * Create an AutomationAction + paired WorkerTask for the campaign session.
 * Body: { actionType, payload?, priority? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const sessionId = params.id

  let body: {
    actionType: string
    payload?: Record<string, unknown>
    priority?: number
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.actionType) {
    return NextResponse.json({ error: 'actionType is required' }, { status: 400 })
  }

  // Verify the session belongs to the user
  const session = await prisma.campaignSession.findFirst({
    where: { id: sessionId, userId: auth.id },
    select: { id: true },
  })

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const priority = body.priority ?? 5

  // Idempotency key: userId + actionType + campaignSessionId + Date.now()
  const idempotencyKey = `${auth.id}-${body.actionType}-${sessionId}-${Date.now()}`

  // Create AutomationAction
  const action = await prisma.automationAction.create({
    data: {
      userId: auth.id,
      campaignSessionId: sessionId,
      source: 'USER',
      actionType: body.actionType,
      payloadJson: JSON.stringify(body.payload ?? {}),
      status: 'PENDING',
      idempotencyKey,
      priority,
      requestedAt: new Date(),
    },
  })

  // Create paired WorkerTask with status PENDING, taskType = automation_action
  const workerTask = await prisma.workerTask.create({
    data: {
      type: 'automation_action',
      payloadJson: JSON.stringify({
        actionId: action.id,
        actionType: body.actionType,
        campaignSessionId: sessionId,
        payload: body.payload ?? {},
      }),
      status: 'PENDING',
      priority,
      testLaunchId: null,
    },
  })

  return NextResponse.json(
    {
      action: { id: action.id, actionType: action.actionType, status: action.status },
      task: { id: workerTask.id, type: workerTask.type, status: workerTask.status },
    },
    { status: 201 }
  )
}
