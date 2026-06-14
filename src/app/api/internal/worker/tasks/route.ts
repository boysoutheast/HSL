import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateApiKey, unauthorizedResponse } from '../../_lib/api-key-auth'

export const runtime = 'nodejs'

/**
 * GET /api/internal/worker/tasks
 * Lists worker tasks with optional filters.
 * Query params: type, status, workerId, testLaunchId, limit, offset
 */
export async function GET(req: NextRequest) {
  if (!validateApiKey(req)) {
    return unauthorizedResponse()
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const status = searchParams.get('status')
  const workerId = searchParams.get('workerId')
  const testLaunchId = searchParams.get('testLaunchId')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 100)
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0)

  const where: Record<string, unknown> = {}
  if (type) where.type = type
  if (status) where.status = status
  if (workerId) where.workerId = workerId
  if (testLaunchId) where.testLaunchId = testLaunchId

  try {
    const [tasks, total] = await Promise.all([
      prisma.workerTask.findMany({
        where,
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
        take: limit,
        skip: offset,
        include: {
          testLaunch: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      }),
      prisma.workerTask.count({ where }),
    ])

    const tasksWithPayload = tasks.map((task) => {
      let payload: unknown = null
      let result: unknown = null
      try {
        if (task.payloadJson) payload = JSON.parse(task.payloadJson)
      } catch { /* ignore */ }
      try {
        if (task.resultJson) result = JSON.parse(task.resultJson)
      } catch { /* ignore */ }
      return { ...task, payload, result }
    })

    return NextResponse.json({
      tasks: tasksWithPayload,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + tasks.length < total,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[worker/tasks/list] Error:', message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/**
 * POST /api/internal/worker/tasks
 * Creates a new worker task.
 * Input: { type, payload, priority?, maxAttempts?, testLaunchId? }
 */
export async function POST(req: NextRequest) {
  if (!validateApiKey(req)) {
    return unauthorizedResponse()
  }

  let body: {
    type: string
    payload?: Record<string, unknown>
    priority?: number
    maxAttempts?: number
    testLaunchId?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { type, payload, priority = 5, maxAttempts = 3, testLaunchId } = body

  if (!type) {
    return NextResponse.json({ error: 'type is required' }, { status: 400 })
  }

  try {
    const payloadJson = payload ? JSON.stringify(payload) : '{}'

    const task = await prisma.workerTask.create({
      data: {
        type,
        payloadJson,
        priority,
        maxAttempts,
        testLaunchId,
        scope: 'internal',
        status: 'pending',
      },
    })

    return NextResponse.json({ task }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[worker/tasks/create] Error:', message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
