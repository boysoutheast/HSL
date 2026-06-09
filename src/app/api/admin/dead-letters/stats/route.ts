import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/admin/dead-letters/stats
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [total, byStatus, byTaskType, oldestEntry, recentCount] = await Promise.all([
    prisma.deadLetterEntry.count(),
    prisma.deadLetterEntry.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.deadLetterEntry.groupBy({
      by: ['taskType'],
      _count: { id: true },
    }),
    prisma.deadLetterEntry.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    prisma.deadLetterEntry.count({
      where: { createdAt: { gte: twentyFourHoursAgo } },
    }),
  ])

  const byStatusMap: Record<string, number> = {}
  for (const row of byStatus) {
    byStatusMap[row.status] = row._count.id
  }

  const byTaskTypeMap: Record<string, number> = {}
  for (const row of byTaskType) {
    byTaskTypeMap[row.taskType] = row._count.id
  }

  return NextResponse.json({
    total,
    byStatus: byStatusMap,
    byTaskType: byTaskTypeMap,
    oldestCreatedAt: oldestEntry?.createdAt ?? null,
    recentCount24h: recentCount,
  })
}
