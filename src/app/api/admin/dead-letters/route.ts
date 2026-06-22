import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/admin/dead-letters — list dead letters with filter/pagination (read-only observability)
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const taskType = searchParams.get('taskType')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (taskType) where.taskType = taskType

  const [entries, total] = await Promise.all([
    prisma.deadLetterEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.deadLetterEntry.count({ where }),
  ])

  return NextResponse.json({
    entries,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  })
}
