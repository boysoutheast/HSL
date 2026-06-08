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
  const agent = await getWorkerAgent(req)
  if (!agent) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tasks = await prisma.workerTask.findMany({
    where: { status: 'pending' },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    take: 10,
  })

  return NextResponse.json({ tasks })
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
