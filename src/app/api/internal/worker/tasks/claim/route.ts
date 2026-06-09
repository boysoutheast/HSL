import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateApiKey, unauthorizedResponse } from '../../../_lib/api-key-auth'

export const runtime = 'nodejs'

/**
 * POST /api/internal/worker/tasks/claim
 * Claims pending tasks for a worker using FOR UPDATE SKIP LOCKED.
 * Input: { workerId, mode, capabilities[], maxTasks }
 * Returns: claimed tasks with leaseDurationSeconds
 */
export async function POST(req: NextRequest) {
  if (!validateApiKey(req)) {
    return unauthorizedResponse()
  }

  let body: {
    workerId: string
    mode?: string
    capabilities?: string[]
    maxTasks?: number
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { workerId, mode = 'standard', capabilities = [], maxTasks = 5 } = body

  if (!workerId) {
    return NextResponse.json({ error: 'workerId is required' }, { status: 400 })
  }

  const leaseDurationSeconds = 60

  try {
    // Use raw SQL with FOR UPDATE SKIP LOCKED to claim tasks atomically
    // Priority ordering: P0 (1) > P1 (2) > P2 (5)
    const claimedTasks = await prisma.$queryRaw<Array<{
      id: string
      type: string
      payloadJson: string
      status: string
      priority: number
      testLaunchId: string | null
      createdAt: Date
    }>>`
      SELECT id, type, payload_json as "payloadJson", status, priority, test_launch_id as "testLaunchId", created_at as "createdAt"
      FROM worker_tasks
      WHERE status = 'pending'
        AND (attempts < max_attempts OR max_attempts IS NULL)
      ORDER BY priority ASC, created_at ASC
      LIMIT ${maxTasks}
      FOR UPDATE SKIP LOCKED
    `

    if (claimedTasks.length === 0) {
      return NextResponse.json({
        claimed: 0,
        tasks: [],
        leaseDurationSeconds,
        workerId,
      })
    }

    const taskIds = claimedTasks.map((t) => t.id)
    const now = new Date()
    const leaseExpiresAt = new Date(now.getTime() + leaseDurationSeconds * 1000)

    // Update claimed tasks
    await prisma.workerTask.updateMany({
      where: { id: { in: taskIds } },
      data: {
        status: 'processing',
        workerId,
        startedAt: now,
      },
    })

    // Parse payload JSON for each task
    const tasksWithPayload = claimedTasks.map((task) => {
      let payload: unknown = null
      try {
        if (task.payloadJson) {
          payload = JSON.parse(task.payloadJson)
        }
      } catch {
        // ignore parse errors
      }
      return {
        ...task,
        payload,
        leaseExpiresAt: leaseExpiresAt.toISOString(),
      }
    })

    return NextResponse.json({
      claimed: claimedTasks.length,
      tasks: tasksWithPayload,
      leaseDurationSeconds,
      workerId,
      mode,
      capabilities,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[worker/tasks/claim] Error:', message)
    return NextResponse.json({ error: 'Failed to claim tasks', message }, { status: 500 })
  }
}
