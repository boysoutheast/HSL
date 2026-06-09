import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, ownerFilter } from '@/lib/auth'

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
  const pageId = searchParams.get('pageId') ?? undefined

  const where: Record<string, unknown> = {}
  if (metaAccountId) where.metaAccountId = metaAccountId
  if (status) where.status = status
  if (pageId) where.metaPageId = pageId

  const [posts, total, draft, published, scheduled, failed] = await Promise.all([
    prisma.metaPost.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        metaPage: { select: { id: true, pageId: true, pageName: true } },
        _count: { select: { schedules: true } },
      },
    }),
    prisma.metaPost.count({ where }),
    prisma.metaPost.count({ where: { ...where, status: 'draft' } }),
    prisma.metaPost.count({ where: { ...where, status: 'published' } }),
    prisma.metaPost.count({ where: { ...where, status: 'scheduled' } }),
    prisma.metaPost.count({ where: { ...where, status: 'failed' } }),
  ])

  return NextResponse.json({
    posts,
    total,
    stats: { draft, published, scheduled, failed },
    pagination: { page, limit, total },
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    metaAccountId?: string
    metaPageId?: string
    title?: string
    message?: string
    mediaUrlsJson?: string
    linkUrl?: string
    postType?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.metaAccountId) {
    return NextResponse.json({ error: 'metaAccountId is required' }, { status: 400 })
  }

  const post = await prisma.metaPost.create({
    data: {
      metaAccountId: body.metaAccountId,
      metaPageId: body.metaPageId,
      title: body.title,
      message: body.message,
      mediaUrlsJson: body.mediaUrlsJson,
      linkUrl: body.linkUrl,
      postType: body.postType ?? 'feed',
      status: 'draft',
    },
    include: {
      metaPage: { select: { id: true, pageId: true, pageName: true } },
    },
  })

  return NextResponse.json({ post }, { status: 201 })
}
