import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateHermesApiKey } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function getWorkerAgent(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (apiKey) {
    return validateHermesApiKey(apiKey)
  }
  const { getSessionUser } = await import('@/lib/session')
  return getSessionUser(req)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const agent = await getWorkerAgent(req)
  if (!agent) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    status?: 'completed' | 'failed' | 'processing'
    lastError?: string
    resultJson?: string
    workerId?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.status || !['completed', 'failed', 'processing'].includes(body.status)) {
    return NextResponse.json({ error: 'status must be "completed", "failed", or "processing"' }, { status: 400 })
  }

  // Validate resultJson is valid JSON if provided
  if (body.resultJson !== undefined) {
    try {
      JSON.parse(body.resultJson)
    } catch {
      return NextResponse.json({ error: 'resultJson must be valid JSON' }, { status: 400 })
    }
  }

  const task = await prisma.workerTask.findUnique({
    where: { id: params.id },
  })

  if (!task) {
    return NextResponse.json({ error: 'WorkerTask not found' }, { status: 404 })
  }

  const now = new Date()
  const newAttempts = task.attempts + 1
  const shouldFail = body.status === 'failed' || newAttempts >= task.maxAttempts

  const updateData: Record<string, any> = {
    status: shouldFail ? 'failed' : body.status,
    lastError: body.lastError ?? task.lastError,
    attempts: newAttempts,
    completedAt: body.status === 'completed' ? now : task.completedAt,
    startedAt: body.status === 'processing' ? now : task.startedAt,
    workerId: body.status === 'processing' && body.workerId ? body.workerId : task.workerId,
  }

  if (body.resultJson !== undefined) {
    updateData.resultJson = body.resultJson
  }

  const updated = await prisma.workerTask.update({
    where: { id: params.id },
    data: updateData,
  })

  return NextResponse.json({ task: updated })
}
