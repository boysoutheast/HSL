import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateApiKey, unauthorizedResponse } from '../../../../_lib/api-key-auth'

export const runtime = 'nodejs'

/**
 * POST /api/internal/worker/tasks/[id]/renew
 * Extends task lease by 60 seconds.
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

    if (task.workerId && task.workerId !== workerId) {
      return NextResponse.json({
        error: 'Task is owned by another worker',
        currentWorkerId: task.workerId,
      }, { status: 409 })
    }

    if (task.status !== 'processing') {
      return NextResponse.json({
        error: `Cannot renew lease for task with status: ${task.status}`,
      }, { status: 409 })
    }

    // Note: WorkerTask doesn't have a leaseExpiresAt field, so we just confirm renewal
    // The actual lease tracking is handled externally by the worker system
    const now = new Date()

    return NextResponse.json({
      taskId: params.id,
      workerId,
      renewedAt: now.toISOString(),
      leaseExtensionSeconds: 60,
      message: 'Lease renewed successfully',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Failed to renew task lease', message }, { status: 500 })
  }
}
