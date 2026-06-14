import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiKey } from '@/lib/api-key-auth'

export const dynamic = 'force-dynamic'

// GET /api/gen/tasks/[id] — user sees their own task detail
// Returns 404 if task doesn't exist or belongs to another user
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await requireApiKey(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const task = await prisma.workerTask.findFirst({
    where: {
      id: params.id,
      scope: 'user',
      ownerUserId: user.id,
    },
    select: {
      id: true,
      type: true,
      status: true,
      scope: true,
      priority: true,
      attempts: true,
      maxAttempts: true,
      lastError: true,
      resultJson: true,
      payloadJson: true,
      createdAt: true,
      startedAt: true,
      completedAt: true,
    },
  })

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  return NextResponse.json({
    ...task,
    payload: safeParse(task.payloadJson),
    result: safeParse(task.resultJson),
    payloadJson: undefined,
    resultJson: undefined,
  })
}

function safeParse(json: string | null): unknown {
  if (!json) return null
  try { return JSON.parse(json) } catch { return null }
}
