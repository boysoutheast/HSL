import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

// POST /api/admin/dead-letters/retry/[id]
// Re-enqueue the task — creates new WorkerTask from dead letter payload, marks DL REVIEWED
export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  const entry = await prisma.deadLetterEntry.findUnique({ where: { id } })
  if (!entry) {
    return NextResponse.json({ error: 'Dead letter entry not found' }, { status: 404 })
  }

  if (entry.status === 'RETRIED') {
    return NextResponse.json({ error: 'This entry has already been retried' }, { status: 409 })
  }

  // Parse the original payload
  let payload: Record<string, unknown> = {}
  try {
    payload = JSON.parse(entry.payloadJson)
  } catch {
    payload = {}
  }

  // Create a new WorkerTask with the same type and payload
  const [newTask, updatedEntry] = await prisma.$transaction([
    prisma.workerTask.create({
      data: {
        type: entry.taskType,
        payloadJson: entry.payloadJson,
        status: 'pending',
        priority: 5,
        attempts: 0,
        maxAttempts: 3,
        // No testLaunchId — the payload should contain all necessary context
      },
    }),
    prisma.deadLetterEntry.update({
      where: { id },
      data: {
        status: 'REVIEWED',
        resolution: `Retried as worker task ${entry.workerTaskId} → new task created`,
        resolvedAt: new Date(),
      },
    }),
  ])

  return NextResponse.json(
    {
      entry: updatedEntry,
      newTask: {
        id: newTask.id,
        type: newTask.type,
        status: newTask.status,
        priority: newTask.priority,
      },
    },
    { status: 201 }
  )
}
