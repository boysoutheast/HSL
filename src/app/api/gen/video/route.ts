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

  let form: FormData
  try { form = await req.formData() } catch {
    return NextResponse.json({ error: 'Request must be multipart/form-data' }, { status: 400 })
  }

  const prompt = (form.get('prompt') as string | null)?.trim() ?? ''
  const orientation = (form.get('orientation') as string | null) ?? 'portrait'
  const resolution = (form.get('resolution') as string | null) === 'HD' ? 'HD' : 'SD'
  const durationSeconds = parseInt(form.get('durationSeconds') as string ?? '10', 10) || 10

  const file = form.get('file') as File | null
  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'file must be JPEG, PNG, or WebP' }, { status: 400 })
  }

  const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'file must be under 10 MB' }, { status: 400 })
  }

  const MAX_PROMPT = 2000
  if (prompt.length > MAX_PROMPT) {
    return NextResponse.json({ error: `prompt max ${MAX_PROMPT} characters` }, { status: 400 })
  }

  const imageBuffer = Buffer.from(await file.arrayBuffer())
  const imageFilename = file.name || 'reference.jpg'

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

    return { id: gm.id, creditsCost, balanceAfter: updatedUser.creditBalance }
  })

  // ── Direct GeminiGen submit (outside transaction) ──
  let externalJobId: string | null = null
  try {
    const { submitVideoJob } = await import('@/lib/geminigen')

    const aspectRatio = orientation === 'landscape' ? 'landscape'
      : orientation === 'square' ? 'square'
      : 'portrait'

    externalJobId = await submitVideoJob({
      prompt,
      aspectRatio,
      durationSeconds: duration,
      imageBuffer,
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
