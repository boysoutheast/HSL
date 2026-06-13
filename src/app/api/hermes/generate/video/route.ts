import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateHermesApiKey, extractBearerToken } from '@/lib/auth'
import { debitCredits, InsufficientCreditsError, VIDEO_10S_COST } from '@/lib/credits'

export const dynamic = 'force-dynamic'

// POST /api/hermes/generate/video — submit a video generation job
// Body: { prompt*, photoReferenceIds[1-5], instagramAccountId? }
// Charges credits from agent.ownerUserId. Returns 402 if insufficient.
export async function POST(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) {
    return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
  }

  const agent = await validateHermesApiKey(token)
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401 })
  }

  // Billing owner required
  if (!agent.ownerUserId) {
    return NextResponse.json({ error: 'No billing owner for this agent' }, { status: 403 })
  }

  let body: {
    prompt: string
    photoReferenceIds?: string[]
    instagramAccountId?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  const photoRefIds = Array.isArray(body.photoReferenceIds)
    ? body.photoReferenceIds.slice(0, 5)
    : []

  // Validate photo references belong to this agent's scope
  if (photoRefIds.length > 0) {
    const assignments = await prisma.assignment.findMany({
      where: { hermesAgentId: agent.id, status: 'active' },
      select: { assignableType: true, assignableId: true },
    })

    const scopedCharaIds = assignments.filter(a => a.assignableType === 'character').map(a => a.assignableId)
    const scopedTopicIds = assignments.filter(a => a.assignableType === 'topic').map(a => a.assignableId)
    const scopedProductIds = assignments.filter(a => a.assignableType === 'product').map(a => a.assignableId)

    const refs = await prisma.photoReference.findMany({
      where: { id: { in: photoRefIds }, status: 'active' },
      select: { id: true, characterId: true, topicId: true, productId: true },
    })

    if (refs.length !== photoRefIds.length) {
      return NextResponse.json({ error: 'One or more photoReferenceIds not found' }, { status: 400 })
    }

    // Check each ref is scoped
    for (const ref of refs) {
      const inScope =
        (ref.characterId && scopedCharaIds.includes(ref.characterId)) ||
        (ref.topicId && scopedTopicIds.includes(ref.topicId)) ||
        (ref.productId && scopedProductIds.includes(ref.productId))
      if (!inScope) {
        return NextResponse.json(
          { error: `Photo reference ${ref.id} is not in agent scope` },
          { status: 403 },
        )
      }
    }
  }

  // Debit credits FIRST
  const generatedMediaId = crypto.randomUUID()
  let balanceAfter: number

  try {
    const result = await debitCredits(
      agent.ownerUserId,
      VIDEO_10S_COST,
      'video_generation',
      generatedMediaId,
      `gen_${generatedMediaId}`,
    )
    balanceAfter = result.balanceAfter
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: 'Insufficient credits', balance: err.balance, required: err.required },
        { status: 402 },
      )
    }
    throw err
  }

  // Create GeneratedMedia record
  const media = await prisma.generatedMedia.create({
    data: {
      id: generatedMediaId,
      userId: agent.ownerUserId,
      prompt: body.prompt.trim(),
      instagramAccountId: body.instagramAccountId ?? null,
      mediaType: 'VIDEO',
      creditsCost: VIDEO_10S_COST,
      status: 'queued',
    },
  })

  // Link photo references
  if (photoRefIds.length > 0) {
    await prisma.generatedMediaInput.createMany({
      data: photoRefIds.map((photoRefId, idx) => ({
        generatedMediaId,
        photoReferenceId: photoRefId,
        inputOrder: idx,
      })),
    })
  }

  // Enqueue worker task for Hermes worker to pick up
  const task = await prisma.workerTask.create({
    data: {
      type: 'GENERATE_VIDEO',
      capability: 'content_generation',
      payloadJson: JSON.stringify({
        generatedMediaId,
        prompt: body.prompt.trim(),
        photoReferenceIds: photoRefIds,
        instagramAccountId: body.instagramAccountId ?? null,
        userId: agent.ownerUserId,
      }),
      status: 'pending',
      priority: 5,
      maxAttempts: 2,
    },
  })

  // Link task to media
  await prisma.generatedMedia.update({
    where: { id: generatedMediaId },
    data: { workerTaskId: task.id },
  })

  return NextResponse.json(
    {
      id: generatedMediaId,
      status: 'queued',
      creditsCost: VIDEO_10S_COST,
      balanceRemaining: balanceAfter,
    },
    { status: 201 },
  )
}
