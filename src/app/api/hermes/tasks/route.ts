import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateHermesApiKey, extractBearerToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const HERMES_TASK_TYPES = ['GENERATE_VIDEO', 'GENERATE_PHOTO', 'CAPTION_ONLY', 'POST_CONTENT', 'REFRESH_CREATIVE', 'CEP_GENERATION']

// GET /api/hermes/tasks — list task pending yang match capability agent
// Query: ?types=GENERATE_VIDEO,GENERATE_PHOTO (optional filter)
export async function GET(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })

  const agent = await validateHermesApiKey(token)
  if (!agent) return NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const typesParam = searchParams.get('types')
  const types = typesParam
    ? typesParam.split(',').filter(t => HERMES_TASK_TYPES.includes(t))
    : HERMES_TASK_TYPES

  const tasks = await prisma.workerTask.findMany({
    where: {
      status: 'pending',
      type: { in: types },
      capability: 'content_generation',
      scope: 'internal',
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    take: 10,
    select: {
      id: true,
      type: true,
      payloadJson: true,
      priority: true,
      createdAt: true,
    },
  })

  return NextResponse.json({
    agent: { id: agent.id, name: agent.name },
    tasks: tasks.map(t => ({ ...t, payload: safeParse(t.payloadJson) })),
  })
}

// POST /api/hermes/tasks — claim task pertama yang available
// Body: { taskId?: string, types?: string[] } — taskId spesifik atau auto-pick
export async function POST(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })

  const agent = await validateHermesApiKey(token)
  if (!agent) return NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const types: string[] = Array.isArray(body.types)
    ? body.types.filter((t: string) => HERMES_TASK_TYPES.includes(t))
    : HERMES_TASK_TYPES

  // Atomic claim: update hanya kalau masih pending (optimistic lock via updateMany)
  let claimedId: string | null = null

  if (body.taskId) {
    const updated = await prisma.workerTask.updateMany({
      where: { id: body.taskId, status: 'pending', capability: 'content_generation', scope: 'internal' },
      data: { status: 'processing', workerId: `hermes:${agent.id}`, startedAt: new Date(), attempts: { increment: 1 } },
    })
    if (updated.count === 1) claimedId = body.taskId
  } else {
    // Auto-pick: ambil kandidat lalu coba claim satu per satu
    const candidates = await prisma.workerTask.findMany({
      where: { status: 'pending', type: { in: types }, capability: 'content_generation', scope: 'internal' },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      take: 5,
      select: { id: true },
    })
    for (const c of candidates) {
      const updated = await prisma.workerTask.updateMany({
        where: { id: c.id, status: 'pending' },
        data: { status: 'processing', workerId: `hermes:${agent.id}`, startedAt: new Date(), attempts: { increment: 1 } },
      })
      if (updated.count === 1) { claimedId = c.id; break }
    }
  }

  if (!claimedId) {
    return NextResponse.json({ task: null, message: 'No tasks available' })
  }

  const task = await prisma.workerTask.findUnique({
    where: { id: claimedId },
    select: { id: true, type: true, payloadJson: true, priority: true, createdAt: true },
  })

  return NextResponse.json({
    task: task ? { ...task, payload: safeParse(task.payloadJson) } : null,
  })
}

function safeParse(json: string): unknown {
  try { return JSON.parse(json) } catch { return null }
}
