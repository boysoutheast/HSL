import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateWorkerApiKey } from '@/lib/auth'
import { decode } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

/**
 * GET /api/worker/tokens/[metaConnectionId]
 *
 * Multi-tenant write gate: worker HARUS menyertakan x-task-id header.
 * Token hanya dikembalikan jika task payloadJson mengandung
 * metaConnectionId yang sama dengan URL param — memastikan worker
 * hanya bisa mengambil token untuk task yang legit miliknya.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { metaConnectionId: string } }
) {
  // Auth: x-api-key header
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const agent = await validateWorkerApiKey(apiKey)
  if (!agent) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { metaConnectionId } = params

  // ── Per-tenant gate: verify task ownership ──
  const taskId = req.headers.get('x-task-id')
  if (!taskId) {
    return NextResponse.json(
      { error: 'x-task-id header required — worker must identify which task it is processing' },
      { status: 400 }
    )
  }

  const task = await prisma.workerTask.findUnique({
    where: { id: taskId },
    select: { payloadJson: true, workerId: true, status: true },
  })

  if (!task || !task.payloadJson) {
    return NextResponse.json({ error: 'Task not found or empty payload' }, { status: 404 })
  }

  // Verify task payload references this metaConnectionId
  let payload: Record<string, unknown> = {}
  try { payload = JSON.parse(task.payloadJson) } catch { /* ignore */ }

  const payloadMetaId = payload?.metaAccountId ?? payload?.metaConnectionId ?? null
  if (!payloadMetaId || String(payloadMetaId) !== metaConnectionId) {
    return NextResponse.json(
      { error: 'Task does not own this connection' },
      { status: 403 }
    )
  }

  // ── Fetch + decrypt token ──
  const metaAccount = await prisma.metaAccount.findUnique({
    where: { id: metaConnectionId },
    select: { longLivedTokenEncrypted: true },
  })

  if (!metaAccount || !metaAccount.longLivedTokenEncrypted) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const token = decode(metaAccount.longLivedTokenEncrypted)

  return NextResponse.json({ token })
}
