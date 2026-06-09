import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const actionType = searchParams.get('actionType')
  const source = searchParams.get('source')
  const campaignSessionId = searchParams.get('campaignSessionId')

  const where: Record<string, unknown> = {
    userId: auth.id,
  }
  if (status) where.status = status
  if (actionType) where.actionType = actionType
  if (source) where.source = source
  if (campaignSessionId) where.campaignSessionId = campaignSessionId

  const actions = await prisma.automationAction.findMany({
    where,
    include: {
      campaignSession: {
        select: { id: true, name: true },
      },
    },
    orderBy: { requestedAt: 'desc' },
  })

  return NextResponse.json({ actions })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
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

  if (!body.campaignSessionId || !body.actionType) {
    return NextResponse.json(
      { error: 'campaignSessionId and actionType are required' },
      { status: 400 }
    )
  }

  const { v4: uuidv4 } = await import('uuid')
  const idempotencyKey = uuidv4()

  const action = await prisma.automationAction.create({
    data: {
      userId: auth.id,
      campaignSessionId: body.campaignSessionId,
      source: 'USER',
      actionType: body.actionType,
      targetEntityType: body.targetEntityType,
      targetMetaEntityId: body.targetMetaEntityId,
      payloadJson: JSON.stringify(body.payloadJson ?? {}),
      status: 'PENDING',
      idempotencyKey,
      priority: body.priority ?? 5,
      requestedAt: new Date(),
    },
    include: {
      campaignSession: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ action }, { status: 201 })
}
