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
  const metaPageId = searchParams.get('metaPageId') ?? undefined

  const where: Record<string, unknown> = { status: 'published' }
  if (metaAccountId) where.metaAccountId = metaAccountId
  if (metaPageId) where.metaPageId = metaPageId

  const [content, total, draftCount, publishedCount, scheduledCount, failedCount] = await Promise.all([
    prisma.metaPost.findMany({
      where,
      skip,
      take: limit,
      orderBy: { publishedAt: 'desc' },
      include: {
        metaPage: { select: { id: true, pageId: true, pageName: true } },
        _count: {
          select: {
            stats: true,
          },
        },
      },
    }),
    prisma.metaPost.count({ where }),
    prisma.metaPost.count({ where: { ...where, status: 'draft' } }),
    prisma.metaPost.count({ where: { ...where, status: 'published' } }),
    prisma.metaPost.count({ where: { ...where, status: 'scheduled' } }),
    prisma.metaPost.count({ where: { ...where, status: 'failed' } }),
  ])

  return NextResponse.json({
    content,
    total,
    pages: Math.ceil(total / limit),
    stats: { draft: draftCount, published: publishedCount, scheduled: scheduledCount, failed: failedCount },
    pagination: { page, limit, total },
  })
}
