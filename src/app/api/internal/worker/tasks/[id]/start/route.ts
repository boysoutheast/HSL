import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateApiKey, unauthorizedResponse } from '../../../../_lib/api-key-auth'

export const runtime = 'nodejs'

/**
 * POST /api/internal/worker/tasks/[id]/start
 * Validates lease ownership and marks task as PROCESSING.
 * Input: { workerId }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!validateApiKey(req)) {
    return unauthorizedResponse()
  }

  let body: { workerId: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { workerId } = body
  if (!workerId) {
    return NextResponse.json({ error: 'workerId is required' }, { status: 400 })
  }

  try {
    const task = await prisma.workerTask.findUnique({
      where: { id: params.id },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    if (task.status !== 'pending' && task.status !== 'processing') {
      return NextResponse.json({
        error: `Task cannot be started. Current status: ${task.status}`,
      }, { status: 409 })
    }

    if (task.workerId && task.workerId !== workerId) {
      return NextResponse.json({
        error: 'Task is leased by another worker',
        currentWorkerId: task.workerId,
      }, { status: 409 })
    }

    const now = new Date()
    const updated = await prisma.workerTask.update({
      where: { id: params.id },
      data: {
        status: 'processing',
        workerId,
        startedAt: now,
      },
    })

    return NextResponse.json({
      task: updated,
      startedAt: now.toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Failed to start task', message }, { status: 500 })
  }
}
