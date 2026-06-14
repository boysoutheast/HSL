import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiKey } from '@/lib/api-key-auth'

export const dynamic = 'force-dynamic'

// GET /api/gen/video?limit=20&offset=0 — list jobs
export async function GET(req: NextRequest) {
  const user = await requireApiKey(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 1), 100)
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0)

  const where = { userId: user.id }

  const [total, items] = await prisma.$transaction([
    prisma.generatedMedia.count({ where }),
    prisma.generatedMedia.findMany({
      where,
      select: {
        id: true,
        status: true,
        prompt: true,
        mediaType: true,
        creditsCost: true,
        videoUrl: true,
        thumbnailUrl: true,
        durationSeconds: true,
        errorMessage: true,
        createdAt: true,
        completedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
  ])

  return NextResponse.json({ items, total, limit, offset })
}

// POST /api/gen/video — create video generation job
export async function POST(req: NextRequest) {
  const user = await requireApiKey(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    prompt?: string
    orientation?: string
    resolution?: string
    durationSeconds?: number
    photoReferenceIds?: string[]
  }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const prompt = body.prompt?.trim()
  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  const photoReferenceIds = Array.isArray(body.photoReferenceIds)
    ? body.photoReferenceIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : []

  // Calculate credit cost
  const resolution = body.resolution === 'HD' ? 'HD' : 'SD'
  const duration = body.durationSeconds === 6 ? 6 : 10
  const baseCost = duration <= 6 ? 1000 : 1300
  const creditsCost = resolution === 'HD' ? baseCost * 2 : baseCost

  // Credit check
  if (user.creditBalance < creditsCost) {
    return NextResponse.json({
      error: 'Insufficient credits',
      balance: user.creditBalance,
      required: creditsCost,
    }, { status: 402 })
  }

  // Deduct credits + create job + queue worker task
  const idempotencyKey = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const result = await prisma.$transaction(async (tx) => {
    // Deduct
    const updatedUser = await tx.adminUser.update({
      where: { id: user.id },
      data: { creditBalance: { decrement: creditsCost } },
      select: { creditBalance: true },
    })

    await tx.creditTransaction.create({
      data: {
        userId: user.id,
        amount: -creditsCost,
        reason: 'video_generation',
        balanceAfter: updatedUser.creditBalance,
        idempotencyKey,
      },
    })

    // Create GeneratedMedia
    const orientation = body.orientation || 'portrait'
    const gm = await tx.generatedMedia.create({
      data: {
        userId: user.id,
        prompt,
        status: 'queued',
        mediaType: 'VIDEO',
        model: 'geminigen',
        orientation,
        resolution,
        durationSeconds: duration,
        creditsCost,
      },
    })

    // Create inputs if any
    if (photoReferenceIds.length > 0) {
      // Validate photos belong to user (admin sees all)
      const validPhotos = await tx.photoReference.findMany({
        where: { id: { in: photoReferenceIds } },
        select: { id: true },
      })
      const validIds = new Set(validPhotos.map(p => p.id))
      const orderedIds = photoReferenceIds.filter(id => validIds.has(id))

      if (orderedIds.length > 0) {
        await tx.generatedMediaInput.createMany({
          data: orderedIds.map((photoReferenceId, i) => ({
            generatedMediaId: gm.id,
            photoReferenceId,
            inputOrder: i,
          })),
        })
      }
    }

    // Queue worker task
    await tx.workerTask.create({
      data: {
        type: 'GENERATE_VIDEO',
        capability: 'fast-executor',
        payloadJson: JSON.stringify({
          generatedMediaId: gm.id,
          prompt,
          orientation,
          resolution,
          durationSeconds: duration,
          photoReferenceIds: photoReferenceIds.length > 0 ? photoReferenceIds : undefined,
        }),
        status: 'pending',
        priority: 2,
      },
    })

    return { id: gm.id, creditsCost, balanceAfter: updatedUser.creditBalance }
  })

  return NextResponse.json(result, { status: 201 })
}
