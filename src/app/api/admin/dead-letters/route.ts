import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/admin/dead-letters — list dead letters with filter/pagination
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

// POST /api/admin/dead-letters — create a dead letter entry (called by worker)
export async function POST(req: NextRequest) {
  // Allow worker API key auth OR admin session
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) {
    // Try worker API key auth instead
    const apiKey = req.headers.get('x-api-key')
    if (!apiKey) return auth
    // Worker auth is handled by middleware; if we get here without session, reject
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    workerTaskId: string
    actionId?: string
    taskType: string
    payload: unknown
    errorCode: string
    errorMessage: string
    attemptCount?: number
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { workerTaskId, actionId, taskType, payload, errorCode, errorMessage, attemptCount = 0 } = body

  if (!workerTaskId || !taskType || !errorCode || !errorMessage) {
    return NextResponse.json(
      { error: 'workerTaskId, taskType, errorCode, errorMessage are required' },
      { status: 400 }
    )
  }

  const entry = await prisma.deadLetterEntry.create({
    data: {
      workerTaskId,
      actionId: actionId ?? null,
      taskType,
      payloadJson: JSON.stringify(payload ?? {}),
      errorCode,
      errorMessage,
      attemptCount,
      status: 'PENDING',
    },
  })

  return NextResponse.json({ entry }, { status: 201 })
}
