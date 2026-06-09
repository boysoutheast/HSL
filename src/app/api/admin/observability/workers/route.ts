import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/admin/observability/workers
// Returns worker pool status grouped by mode
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const workers = await prisma.workerRegistry.findMany({
    where: { status: { in: ['ACTIVE', 'IDLE'] } },
    orderBy: { mode: 'asc' },
  })

  // Group by mode
  const poolMap: Record<string, {
    mode: string
    count: number
    lastHeartbeat: string | null
    activeTasks: number
    statuses: string[]
  }> = {}

  for (const w of workers) {
    if (!poolMap[w.mode]) {
      poolMap[w.mode] = { mode: w.mode, count: 0, lastHeartbeat: null, activeTasks: 0, statuses: [] }
    }
    poolMap[w.mode].count++
    poolMap[w.mode].activeTasks += w.activeTaskCount
    poolMap[w.mode].statuses.push(w.status)
    const hb = w.lastHeartbeatAt.getTime()
    if (!poolMap[w.mode].lastHeartbeat || hb > new Date(poolMap[w.mode].lastHeartbeat!).getTime()) {
      poolMap[w.mode].lastHeartbeat = w.lastHeartbeatAt.toISOString()
    }
  }

  const pools = Object.values(poolMap).map(p => ({
    mode: p.mode,
    count: p.count,
    lastHeartbeat: p.lastHeartbeat,
    activeTasks: p.activeTasks,
  }))

  // Sort by known mode names first
  const modeOrder = ['Fast Executor', 'Campaign Builder', 'Creative Top-Up', 'Monitor', 'Rule Evaluator']
  pools.sort((a, b) => {
    const ai = modeOrder.indexOf(a.mode)
    const bi = modeOrder.indexOf(b.mode)
    if (ai === -1 && bi === -1) return a.mode.localeCompare(b.mode)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  return NextResponse.json({ pools })
}
