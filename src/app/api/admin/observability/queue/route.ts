import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/admin/observability/queue
// Returns queue health: total pending, oldest pending age, P0/P1/P2/P3 counts, by capability
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  // Non-terminal statuses
  const activeStatuses = ['pending', 'processing']

  // Total pending + oldest pending age
  const [totalResult, oldestResult] = await Promise.all([
    prisma.workerTask.count({
      where: { status: { in: activeStatuses } },
    }),
    prisma.workerTask.findFirst({
      where: { status: { in: activeStatuses } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
  ])

  // Priority buckets: P0=priority 1, P1=2, P2=3, P3=4
  const [p0Count, p1Count, p2Count, p3Count] = await Promise.all([
    prisma.workerTask.count({ where: { status: { in: activeStatuses }, priority: 1 } }),
    prisma.workerTask.count({ where: { status: { in: activeStatuses }, priority: 2 } }),
    prisma.workerTask.count({ where: { status: { in: activeStatuses }, priority: 3 } }),
    prisma.workerTask.count({ where: { status: { in: activeStatuses }, priority: 4 } }),
  ])

  // By capability: automation_action | rules | monitor | fast-executor
  const [autoCount, rulesCount, monitorCount, fastExecCount] = await Promise.all([
    prisma.workerTask.count({ where: { status: { in: activeStatuses }, capability: 'automation_action' } }),
    prisma.workerTask.count({ where: { status: { in: activeStatuses }, capability: 'rules' } }),
    prisma.workerTask.count({ where: { status: { in: activeStatuses }, capability: 'monitor' } }),
    prisma.workerTask.count({ where: { status: { in: activeStatuses }, capability: 'fast-executor' } }),
  ])

  const oldestPendingAge = oldestResult
    ? Math.floor((Date.now() - oldestResult.createdAt.getTime()) / 1000)
    : 0

  return NextResponse.json({
    totalPending: totalResult,
    oldestPendingAge,
    byPriority: { P0: p0Count, P1: p1Count, P2: p2Count, P3: p3Count },
    byCapability: {
      automation_action: autoCount,
      rules: rulesCount,
      monitor: monitorCount,
      'fast-executor': fastExecCount,
    },
  })
}
