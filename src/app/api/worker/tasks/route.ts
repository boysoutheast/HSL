import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateHermesApiKey, extractBearerToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function getWorkerAgent(req: NextRequest) {
  // Accept x-api-key header for worker auth
  const apiKey = req.headers.get('x-api-key')
  if (apiKey) {
    return validateHermesApiKey(apiKey)
  }
  // Fallback: session auth
  const { getSessionUser } = await import('@/lib/session')
  return getSessionUser(req)
}

export async function GET(req: NextRequest) {
  try {
    const agent = await getWorkerAgent(req)
    if (!agent) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const metaAccountId = searchParams.get('metaAccountId')

    const where: Record<string, unknown> = {}
    if (type) {
      where.type = type
    }
    if (status) {
      where.status = status
    }
    if (metaAccountId) {
      where.payloadJson = { contains: `"metaAccountId":"${metaAccountId}"` }
    }

    const tasks = await prisma.workerTask.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      take: 50,
      include: {
        testLaunch: {
          select: {
            name: true,
            status: true,
          },
        },
      },
    })

    const tasksWithPayload = tasks.map((task) => {
      const result: any = {
        ...task,
        payload: null,
        result: null,
      }
      try {
        if (task.payloadJson) {
          result.payload = JSON.parse(task.payloadJson)
        }
      } catch {
        result.payload = null
      }
      try {
        if (task.resultJson) {
          result.result = JSON.parse(task.resultJson)
        }
      } catch {
        result.result = null
      }
      return result
    })

    return NextResponse.json({ tasks: tasksWithPayload })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Worker tasks GET failed', message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const agent = await getWorkerAgent(req)
  if (!agent) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { taskIds: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!Array.isArray(body.taskIds) || body.taskIds.length === 0) {
    return NextResponse.json({ error: 'taskIds must be a non-empty array' }, { status: 400 })
  }

  const now = new Date()

  // Claim tasks: update status to 'processing', set workerId + startedAt
  const updated = await prisma.workerTask.updateMany({
    where: {
      id: { in: body.taskIds },
      status: 'pending',
    },
    data: {
      status: 'processing',
      workerId: agent.id,
      startedAt: now,
    },
  })

  return NextResponse.json({
    claimed: updated.count,
    workerId: agent.id,
    startedAt: now.toISOString(),
  })
}
