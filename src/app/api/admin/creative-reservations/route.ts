import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/admin/creative-reservations
// Query params: campaignSessionId?, status?, limit?, offset?
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const campaignSessionId = searchParams.get('campaignSessionId')
  const status = searchParams.get('status')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 100)
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0)

  const where: Record<string, unknown> = {}
  if (auth.role !== 'admin') where.campaignSession = { userId: auth.id }
  if (campaignSessionId) where.campaignSessionId = campaignSessionId
  if (status) where.status = status

  const [reservations, total] = await Promise.all([
    prisma.creativeReservation.findMany({
      where,
      include: {
        creativeVariant: {
          select: {
            id: true,
            name: true,
            status: true,
            product: { select: { id: true, name: true } },
          },
        },
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
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.creativeReservation.count({ where }),
  ])

  return NextResponse.json({ reservations, total, limit, offset })
}

// POST /api/admin/creative-reservations
// Body: { creativeVariantId, campaignSessionId, automationActionId, expiresAt }
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    creativeVariantId: string
    campaignSessionId: string
    automationActionId: string
    reservedByWorkerId?: string
    expiresAt: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.creativeVariantId) {
    return NextResponse.json({ error: 'creativeVariantId is required' }, { status: 400 })
  }
  if (!body.campaignSessionId) {
    return NextResponse.json({ error: 'campaignSessionId is required' }, { status: 400 })
  }
  if (!body.automationActionId) {
    return NextResponse.json({ error: 'automationActionId is required' }, { status: 400 })
  }
  if (!body.expiresAt) {
    return NextResponse.json({ error: 'expiresAt is required' }, { status: 400 })
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

  const reservation = await prisma.creativeReservation.create({
    data: {
      creativeVariantId: body.creativeVariantId,
      campaignSessionId: body.campaignSessionId,
      automationActionId: body.automationActionId,
      reservedByWorkerId: body.reservedByWorkerId ?? null,
      status: 'RESERVED',
      expiresAt: new Date(body.expiresAt),
    },
    include: {
      creativeVariant: {
        select: { id: true, name: true, status: true },
      },
      campaignSession: {
        select: { id: true, name: true },
      },
    },
  })

  return NextResponse.json({ reservation }, { status: 201 })
}
