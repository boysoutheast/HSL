import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateWorkerApiKey } from '@/lib/auth'
import { decode } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { metaConnectionId: string } }
) {
  // Auth: x-api-key header only
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const agent = await validateWorkerApiKey(apiKey)
  if (!agent) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { metaConnectionId } = params

  // Scope: worker must prove task belongs to this connection via x-task-id
  const taskId = req.headers.get('x-task-id')
  if (!taskId) {
    return NextResponse.json({ error: 'x-task-id header required' }, { status: 400 })
  }

  const task = await prisma.workerTask.findFirst({
    where: { id: taskId, status: { in: ['pending', 'processing'] } },
    select: { id: true, payloadJson: true, workerId: true },
  })

  if (!task) {
    return NextResponse.json({ error: 'Task not found or not active' }, { status: 404 })
  }

  // Verify task belongs to this worker agent
  if (task.workerId !== agent.id) {
    return NextResponse.json({ error: 'Task not assigned to this agent' }, { status: 403 })
  }

  // Verify task payload references this connection
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(task.payloadJson ?? '{}')
  } catch {
    return NextResponse.json({ error: 'Corrupt task payload' }, { status: 500 })
  }

  const taskConnectionId = (payload.metaAccountId ?? payload.metaConnectionId ?? payload.connectionId) as string | undefined
  if (!taskConnectionId || taskConnectionId !== metaConnectionId) {
    return NextResponse.json({ error: 'Task does not reference this connection' }, { status: 403 })
  }

  // All checks pass — return token
  const metaAccount = await prisma.metaAccount.findUnique({
    where: { id: metaConnectionId },
    select: { longLivedTokenEncrypted: true, status: true },
  })

  if (!metaAccount || !metaAccount.longLivedTokenEncrypted) {
    return NextResponse.json({ error: 'Connection not found or no token' }, { status: 404 })
  }

  if (metaAccount.status !== 'connected') {
    return NextResponse.json({ error: 'Connection not in connected state' }, { status: 400 })
  }

  const token = decode(metaAccount.longLivedTokenEncrypted)

  return NextResponse.json({ token })
}
