import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateApiKey, unauthorizedResponse } from '../../_lib/api-key-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TERMINAL = ['SUCCEEDED', 'FAILED', 'CANCELLED']

/**
 * PATCH /api/internal/actions/[actionId]
 * Worker confirms the result of applying an AutomationAction to Meta.
 * Body: { status: 'SUCCEEDED'|'FAILED'|'UNCERTAIN'|'CANCELLED', metaResponseJson?, errorCode?, errorMessage? }
 * Idempotent: re-confirming an already-terminal action → 409.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { actionId: string } },
) {
  if (!validateApiKey(req)) return unauthorizedResponse()

  let body: {
    status: string
    metaResponseJson?: string
    errorCode?: string
    errorMessage?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const valid = ['SUCCEEDED', 'FAILED', 'UNCERTAIN', 'CANCELLED']
  if (!body.status || !valid.includes(body.status)) {
    return NextResponse.json({ error: `status must be one of ${valid.join(', ')}` }, { status: 400 })
  }

  const action = await prisma.automationAction.findUnique({
    where: { id: params.actionId },
    select: { id: true, status: true },
  })
  if (!action) {
    return NextResponse.json({ error: 'Action not found' }, { status: 404 })
  }
  if (TERMINAL.includes(action.status)) {
    return NextResponse.json({ error: 'Action already resolved', status: action.status }, { status: 409 })
  }

  const now = new Date()
  const updated = await prisma.automationAction.update({
    where: { id: params.actionId },
    data: {
      status: body.status,
      executedAt: now,
      confirmedAt: body.status === 'SUCCEEDED' ? now : null,
      metaResponseJson: body.metaResponseJson ?? null,
      errorCode: body.errorCode ?? null,
      errorMessage: body.errorMessage ?? null,
    },
    select: { id: true, status: true, executedAt: true, confirmedAt: true },
  })

  return NextResponse.json({ action: updated })
}
