import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiKey } from '@/lib/api-key-auth'

export const dynamic = 'force-dynamic'

// GET /api/gen/tasks?status=pending|processing|completed|failed&limit=20&offset=0
// User sees ONLY their own tasks (scope='user', ownerUserId=user.id)
export async function GET(req: NextRequest) {
  const user = await requireApiKey(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const statusParam = searchParams.get('status')
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 1), 100)
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0)

  const where: Record<string, unknown> = {
    scope: 'user',
    ownerUserId: user.id,
  }

  if (statusParam) {
    const validStatuses = ['pending', 'processing', 'completed', 'failed']
    const statuses = statusParam.split(',').filter(s => validStatuses.includes(s))
    if (statuses.length > 0) {
      where.status = { in: statuses }
    }
  }

  const [total, items] = await prisma.$transaction([
    prisma.workerTask.count({ where }),
    prisma.workerTask.findMany({
      where,
      select: {
        id: true,
        type: true,
        status: true,
        scope: true,
        priority: true,
        attempts: true,
        maxAttempts: true,
        lastError: true,
        resultJson: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
  ])

  return NextResponse.json({
    items: items.map(t => ({
      ...t,
      result: safeParse(t.resultJson),
      resultJson: undefined,
    })),
    total,
    limit,
    offset,
  })
}

function safeParse(json: string | null): unknown {
  if (!json) return null
  try { return JSON.parse(json) } catch { return null }
}
