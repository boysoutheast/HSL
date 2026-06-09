import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  const skip = (page - 1) * limit

  const metaAccountId = searchParams.get('metaAccountId') ?? undefined
  const status = searchParams.get('status') ?? undefined

  const where: Record<string, unknown> = {}
  if (metaAccountId) where.metaAccountId = metaAccountId
  if (status) where.status = status

  const [schedules, total] = await Promise.all([
    prisma.metaSchedule.findMany({
      where,
      skip,
      take: limit,
      orderBy: { scheduledFor: 'asc' },
      include: {
        metaPage: { select: { id: true, pageId: true, pageName: true } },
        metaPost: { select: { id: true, title: true, message: true, status: true } },
      },
    }),
    prisma.metaSchedule.count({ where }),
  ])

  return NextResponse.json({
    schedules,
    total,
    pagination: { page, limit, total },
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    metaAccountId?: string
    metaPageId?: string
    metaPostId?: string
    title?: string
    postType?: string
    payloadJson?: string
    scheduledFor?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.metaAccountId) {
    return NextResponse.json({ error: 'metaAccountId is required' }, { status: 400 })
  }

  if (!body.scheduledFor) {
    return NextResponse.json({ error: 'scheduledFor is required' }, { status: 400 })
  }

  const schedule = await prisma.metaSchedule.create({
    data: {
      metaAccountId: body.metaAccountId,
      metaPageId: body.metaPageId,
      metaPostId: body.metaPostId,
      title: body.title,
      postType: body.postType ?? 'feed',
      payloadJson: body.payloadJson ?? '{}',
      scheduledFor: new Date(body.scheduledFor),
      status: 'pending',
    },
    include: {
      metaPage: { select: { id: true, pageId: true, pageName: true } },
      metaPost: { select: { id: true, title: true, message: true, status: true } },
    },
  })

  return NextResponse.json({ schedule }, { status: 201 })
}
