import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const TRIGGER_TYPES = ['MIN_COUNT', 'MAX_AGE_DAYS', 'NO_WINNER']
const TASK_TYPES = ['GENERATE_VIDEO', 'GENERATE_PHOTO', 'CAPTION_ONLY']

// GET /api/admin/media-rules
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const rules = await prisma.mediaLibraryRule.findMany({
    where: auth.role === 'admin' ? {} : { userId: auth.id },
    include: {
      product: { select: { id: true, name: true } },
      character: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ rules })
}

// POST /api/admin/media-rules
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const { name, triggerType, threshold, productId, characterId, mediaType, actionType, taskType, cooldownHours } = body

  if (!name?.trim() || !triggerType || threshold === undefined) {
    return NextResponse.json({ error: 'name, triggerType, threshold are required' }, { status: 400 })
  }
  if (!TRIGGER_TYPES.includes(triggerType)) {
    return NextResponse.json({ error: `triggerType must be one of: ${TRIGGER_TYPES.join(', ')}` }, { status: 400 })
  }
  if (!productId && !characterId) {
    return NextResponse.json({ error: 'productId or characterId is required (rule scope)' }, { status: 400 })
  }
  if (actionType === 'CREATE_TASK' && taskType && !TASK_TYPES.includes(taskType)) {
    return NextResponse.json({ error: `taskType must be one of: ${TASK_TYPES.join(', ')}` }, { status: 400 })
  }

  // Ownership check on scope
  if (productId && auth.role !== 'admin') {
    const product = await prisma.product.findFirst({
      where: { id: productId, createdByUserId: auth.id },
      select: { id: true },
    })
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const rule = await prisma.mediaLibraryRule.create({
    data: {
      userId: auth.id,
      name: name.trim(),
      triggerType,
      threshold: Number(threshold),
      productId: productId ?? null,
      characterId: characterId ?? null,
      mediaType: mediaType ?? 'VIDEO',
      actionType: actionType ?? 'CREATE_TASK',
      taskType: taskType ?? 'GENERATE_VIDEO',
      taskPayloadJson: body.taskPayloadJson ? JSON.stringify(body.taskPayloadJson) : null,
      cooldownHours: cooldownHours ?? 24,
    },
  })

  return NextResponse.json({ rule }, { status: 201 })
}
