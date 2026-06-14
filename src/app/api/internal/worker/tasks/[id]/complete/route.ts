import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateApiKey, unauthorizedResponse } from '../../../../_lib/api-key-auth'

export const runtime = 'nodejs'

/**
 * POST /api/internal/worker/tasks/[id]/complete
 * Marks task as SUCCEEDED or FAILED.
 * Input: { workerId, status, result?, externalReferences?, metrics?, error? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!validateApiKey(req)) {
    return unauthorizedResponse()
  }

  let body: {
    workerId: string
    status: 'succeeded' | 'failed'
    result?: Record<string, unknown>
    externalReferences?: Record<string, string>
    metrics?: Record<string, number>
    error?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { workerId, status, result, externalReferences, metrics, error } = body

  if (!workerId) {
    return NextResponse.json({ error: 'workerId is required' }, { status: 400 })
  }

  if (!status || !['succeeded', 'failed'].includes(status)) {
    return NextResponse.json({ error: 'status must be "succeeded" or "failed"' }, { status: 400 })
  }

  try {
    const task = await prisma.workerTask.findUnique({
      where: { id: params.id },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    if (task.workerId && task.workerId !== workerId) {
      return NextResponse.json({
        error: 'Task is owned by another worker',
        currentWorkerId: task.workerId,
      }, { status: 409 })
    }

    const now = new Date()
    const resultJsonObj: Record<string, unknown> = {
      ...(result || {}),
    }

    if (externalReferences) {
      resultJsonObj.externalReferences = externalReferences
    }
    if (metrics) {
      resultJsonObj.metrics = metrics
    }

    const updated = await prisma.workerTask.update({
      where: { id: params.id },
      data: {
        status: status === 'succeeded' ? 'completed' : 'failed',
        resultJson: JSON.stringify(resultJsonObj),
        lastError: error || null,
        completedAt: now,
        startedAt: task.startedAt || now,
        attempts: task.attempts + 1,
      },
    })

    return NextResponse.json({
      task: updated,
      completedAt: now.toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[worker/tasks/complete] Error:', message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
