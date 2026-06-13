import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runSaasResponder } from '@/lib/saas-responder'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/internal/worker/events
 * Worker reports task completion/failure/input-needed.
 * Auth: x-api-key header matching WORKER_API_KEY env.
 * Idempotent via unique event_id.
 */
export async function POST(req: NextRequest) {
  // 1. Auth
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.WORKER_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse body
  let body: {
    eventId: string
    subjectType: string
    subjectId: string
    status: string
    summary: string
    dataJson?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.eventId?.trim() || !body.subjectType?.trim() || !body.summary?.trim()) {
    return NextResponse.json({ error: 'eventId, subjectType, and summary are required' }, { status: 400 })
  }

  // 3. Idempotency check — if event_id already processed, return existing
  const existingEvent = await prisma.threadMessage.findFirst({
    where: { eventId: body.eventId.trim() },
    select: { threadId: true },
  })

  if (existingEvent) {
    return NextResponse.json({
      threadId: existingEvent.threadId,
      duplicate: true,
    })
  }

  // 4. Upsert thread by (subjectType, subjectId)
  const thread = await prisma.conversationThread.findFirst({
    where: {
      subjectType: body.subjectType.trim(),
      subjectId: body.subjectId?.trim() ?? null,
    },
  })

  const threadId = thread?.id ?? crypto.randomUUID()

  if (!thread) {
    await prisma.conversationThread.create({
      data: {
        id: threadId,
        subjectType: body.subjectType.trim(),
        subjectId: body.subjectId?.trim() ?? null,
        status: 'open',
      },
    })
  }

  // 5. Insert worker message
  await prisma.threadMessage.create({
    data: {
      threadId,
      role: 'worker',
      kind: 'event',
      content: body.summary.trim(),
      eventId: body.eventId.trim(),
      metadataJson: body.dataJson ?? null,
    },
  })

  // 6. Run SaaS responder
  // Fire-and-forget: don't block response on LLM
  runSaasResponder(threadId).catch(err => {
    console.error('[worker/events] runSaasResponder failed:', (err as Error).message)
  })

  // 7. Return immediately
  return NextResponse.json({ threadId }, { status: 200 })
}
