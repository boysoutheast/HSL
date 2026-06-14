import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/admin/creative-rotations
// Query params: campaignSessionId?, status?, strategy?, limit?, offset?
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const campaignSessionId = searchParams.get('campaignSessionId')
  const status = searchParams.get('status')
  const strategy = searchParams.get('strategy')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 100)
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0)

  const where: Record<string, unknown> = {}
  if (auth.role !== 'admin') where.campaignSession = { userId: auth.id }
  if (campaignSessionId) where.campaignSessionId = campaignSessionId
  if (status) where.status = status
  if (strategy) where.strategy = strategy

  const [rotations, total] = await Promise.all([
    prisma.creativeRotation.findMany({
      where,
      include: {
        campaignSession: {
          select: {
            id: true,
            name: true,
            status: true,
            userId: true,
          },
        },
        automationAction: {
          select: {
            id: true,
            actionType: true,
            status: true,
            createdAt: true,
          },
        },
        oldCreativeVariant: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        newCreativeVariant: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.creativeRotation.count({ where }),
  ])

  return NextResponse.json({ rotations, total, limit, offset })
}

// POST /api/admin/creative-rotations
// Body: { campaignSessionId, automationActionId, newCreativeVariantId, oldCreativeVariantId?, oldMetaAdId?, strategy, triggerReason? }
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    campaignSessionId: string
    automationActionId: string
    newCreativeVariantId: string
    oldCreativeVariantId?: string
    oldMetaAdId?: string
    strategy: string
    triggerReason?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.campaignSessionId) {
    return NextResponse.json({ error: 'campaignSessionId is required' }, { status: 400 })
  }
  if (!body.automationActionId) {
    return NextResponse.json({ error: 'automationActionId is required' }, { status: 400 })
  }
  if (!body.newCreativeVariantId) {
    return NextResponse.json({ error: 'newCreativeVariantId is required' }, { status: 400 })
  }
  if (!body.strategy) {
    return NextResponse.json({ error: 'strategy is required' }, { status: 400 })
  }
  if (!['NO_GAP', 'STOP_FIRST'].includes(body.strategy)) {
    return NextResponse.json({ error: 'strategy must be NO_GAP or STOP_FIRST' }, { status: 400 })
  }

  // Verify ownership of campaign session
  const session = await prisma.campaignSession.findUnique({
    where: { id: body.campaignSessionId },
    select: { userId: true },
  })
  if (!session) {
    return NextResponse.json({ error: 'Campaign session not found' }, { status: 404 })
  }
  if (session.userId !== auth.id && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rotation = await prisma.creativeRotation.create({
    data: {
      campaignSessionId: body.campaignSessionId,
      automationActionId: body.automationActionId,
      newCreativeVariantId: body.newCreativeVariantId,
      oldCreativeVariantId: body.oldCreativeVariantId ?? null,
      oldMetaAdId: body.oldMetaAdId ?? null,
      strategy: body.strategy,
      triggerReason: body.triggerReason ?? null,
      status: 'PENDING',
      startedAt: new Date(),
    },
    include: {
      campaignSession: {
        select: { id: true, name: true },
      },
      newCreativeVariant: {
        select: { id: true, name: true, status: true },
      },
      oldCreativeVariant: {
        select: { id: true, name: true, status: true },
      },
    },
  })

  return NextResponse.json({ rotation }, { status: 201 })
}
