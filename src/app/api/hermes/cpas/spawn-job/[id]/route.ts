import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateHermesApiKey, extractBearerToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const STAGE_ORDER = ['cpas_spawn_plan', 'cpas_image_submit', 'cpas_image_poll', 'cpas_adset_write']
const STAGE_LABEL: Record<string, string> = {
  cpas_spawn_plan: 'plan',
  cpas_image_submit: 'image_submitted',
  cpas_image_poll: 'images_ready',
  cpas_adset_write: 'adset_written',
}

async function authenticate(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) return null
  return validateHermesApiKey(token)
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const agent = await authenticate(req)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const task = await prisma.workerTask.findUnique({
    where: { id },
    select: { id: true, type: true, status: true, resultJson: true, createdAt: true, completedAt: true },
  })

  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    id: task.id,
    status: task.status,
    stage: STAGE_LABEL[task.type] ?? task.type,
    resultJson: task.resultJson ? JSON.parse(task.resultJson) : null,
    createdAt: task.createdAt,
    completedAt: task.completedAt,
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const agent = await authenticate(req)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  let body: { status?: string; stage?: string; resultJson?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const task = await prisma.workerTask.findUnique({ where: { id } })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Validate stage progression — only forward moves allowed
  if (body.stage) {
    const stageToType = Object.fromEntries(Object.entries(STAGE_LABEL).map(([k, v]) => [v, k]))
    const newType = stageToType[body.stage]
    if (newType) {
      const currentIdx = STAGE_ORDER.indexOf(task.type)
      const newIdx = STAGE_ORDER.indexOf(newType)
      if (newIdx < currentIdx) {
        return NextResponse.json({ error: 'Cannot move stage backward' }, { status: 400 })
      }
    }
  }

  const updated = await prisma.workerTask.update({
    where: { id },
    data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.resultJson ? { resultJson: JSON.stringify(body.resultJson) } : {}),
      ...(body.status === 'completed' ? { completedAt: new Date() } : {}),
      ...(body.status === 'processing' ? { startedAt: new Date() } : {}),
    },
  })

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    stage: STAGE_LABEL[updated.type] ?? updated.type,
  })
}
