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
// Accepts multipart/form-data (with file) OR application/json
// Multipart fields: prompt, orientation, resolution, durationSeconds, file (image binary)
// JSON fields:      prompt, orientation, resolution, durationSeconds, photoReferenceIds[]
export async function POST(req: NextRequest) {
  const user = await requireApiKey(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const contentType = req.headers.get('content-type') ?? ''
  const isMultipart = contentType.includes('multipart/form-data')

  let prompt = ''
  let orientation = 'portrait'
  let resolution = 'SD'
  let durationSeconds = 10
  let photoReferenceIds: string[] = []
  let imageBuffer: Buffer | undefined
  let imageFilename: string | undefined

  if (isMultipart) {
    let form: FormData
    try { form = await req.formData() } catch {
      return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 })
    }
    prompt = (form.get('prompt') as string | null)?.trim() ?? ''
    orientation = (form.get('orientation') as string | null) ?? 'portrait'
    resolution = (form.get('resolution') as string | null) === 'HD' ? 'HD' : 'SD'
    durationSeconds = parseInt(form.get('durationSeconds') as string ?? '10', 10) || 10
    const file = form.get('file') as File | null
    if (file && file.size > 0) {
      imageBuffer = Buffer.from(await file.arrayBuffer())
      imageFilename = file.name || 'reference.jpg'
    }
  } else {
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
    prompt = body.prompt?.trim() ?? ''
    orientation = body.orientation ?? 'portrait'
    resolution = body.resolution === 'HD' ? 'HD' : 'SD'
    durationSeconds = body.durationSeconds ?? 10
    photoReferenceIds = Array.isArray(body.photoReferenceIds)
      ? body.photoReferenceIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : []
  }

  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  // Calculate credit cost
  const duration = durationSeconds === 6 ? 6 : 10
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

  // Deduct credits + create job (no worker task — GeminiGen called directly)
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

    return { id: gm.id, creditsCost, balanceAfter: updatedUser.creditBalance }
  })

  // ── Direct GeminiGen submit (outside transaction) ──
  let externalJobId: string | null = null
  try {
    const { submitVideoJob } = await import('@/lib/geminigen')

    // Resolve photo URLs (only for JSON flow with photoReferenceIds)
    let imageUrls: string[] = []
    if (!imageBuffer && photoReferenceIds.length > 0) {
      const photos = await prisma.photoReference.findMany({
        where: { id: { in: photoReferenceIds } },
        select: { fileUrl: true },
      })
      imageUrls = photos.map(p => p.fileUrl)
    }

    const aspectRatio = orientation === 'landscape' ? 'landscape'
      : orientation === 'square' ? 'square'
      : 'portrait'

    externalJobId = await submitVideoJob({
      prompt,
      aspectRatio,
      durationSeconds: duration,
      imageUrls,
      imageBuffer,       // direct upload — takes priority over imageUrls
      imageFilename,
    })

    // Store externalJobId + mark processing
    await prisma.generatedMedia.update({
      where: { id: result.id },
      data: { externalJobId, status: 'processing' },
    })

  } catch (err) {
    console.error('[gen/video] GeminiGen submit failed:', err)
    await prisma.$transaction([
      prisma.generatedMedia.update({
        where: { id: result.id },
        data: { status: 'failed', errorMessage: String(err) },
      }),
      prisma.adminUser.update({
        where: { id: user.id },
        data: { creditBalance: { increment: creditsCost } },
      }),
    ])
    return NextResponse.json(
      { error: 'Video generation service unavailable. Credits refunded.' },
      { status: 503 },
    )
  }

  return NextResponse.json(
    { id: result.id, status: 'processing', creditsCost, balanceAfter: result.balanceAfter },
    { status: 201 },
  )
}
