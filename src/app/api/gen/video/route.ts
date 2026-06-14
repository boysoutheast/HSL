import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateHermesApiKey, extractBearerToken } from '@/lib/auth'
import { debitCredits, InsufficientCreditsError } from '@/lib/credits'

export const dynamic = 'force-dynamic'

const COST_MATRIX: Record<string, Record<string, number>> = {
  SD: { '5': 800, '6': 1000, '8': 1300, '10': 1500 },
  HD: { '5': 1500, '6': 1800, '8': 2400, '10': 3000 },
  FHD: { '5': 3000, '6': 3500, '8': 5000, '10': 6500 },
}

export async function POST(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })

  const agent = await validateHermesApiKey(token)
  if (!agent) return NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401 })
  if (!agent.ownerUserId) return NextResponse.json({ error: 'No billing owner for this agent' }, { status: 403 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const prompt = (body.prompt || '').trim()
  if (!prompt || prompt.length < 3) return NextResponse.json({ error: 'prompt required (min 3 chars)' }, { status: 400 })

  const orientation = (body.orientation || 'portrait').toLowerCase()
  if (!['portrait', 'landscape', 'square'].includes(orientation)) return NextResponse.json({ error: 'invalid orientation' }, { status: 400 })

  const resolution = (body.resolution || 'SD').toUpperCase()
  if (!['SD', 'HD', 'FHD'].includes(resolution)) return NextResponse.json({ error: 'invalid resolution' }, { status: 400 })

  const durationSeconds = parseInt(String(body.durationSeconds || 6), 10)
  const durationKey = String(durationSeconds)
  const costRow = COST_MATRIX[resolution]
  if (!costRow) return NextResponse.json({ error: 'invalid resolution' }, { status: 400 })
  const creditsCost = costRow[durationKey]
  if (!creditsCost) return NextResponse.json({ error: 'invalid duration (5,6,8,10)' }, { status: 400 })

  const photoRefIds: string[] = Array.isArray(body.photoReferenceIds) ? body.photoReferenceIds : []

  // Verify photo references in scope
  if (photoRefIds.length > 0) {
    const refs = await prisma.photoReference.findMany({ where: { id: { in: photoRefIds } } })
    if (refs.length !== photoRefIds.length) return NextResponse.json({ error: 'Some photo references not found' }, { status: 404 })
    // Scope via instagramAccountId from photo ref chain
  }

  const generatedMediaId = crypto.randomUUID()
  let balanceAfter: number

  try {
    const result = await debitCredits(agent.ownerUserId, creditsCost, 'video_generation', generatedMediaId, `gen_${generatedMediaId}`)
    balanceAfter = result.balanceAfter
  } catch (err) {
    if (err instanceof InsufficientCreditsError) return NextResponse.json({ error: 'Insufficient credits', balance: err.balance, required: err.required }, { status: 402 })
    throw err
  }

  const media = await prisma.generatedMedia.create({
    data: {
      id: generatedMediaId, userId: agent.ownerUserId, prompt, instagramAccountId: body.instagramAccountId ?? null,
      mediaType: 'VIDEO', creditsCost, orientation, resolution, durationSeconds, status: 'queued',
    },
  })

  if (photoRefIds.length > 0) {
    await prisma.generatedMediaInput.createMany({
      data: photoRefIds.map((pid, idx) => ({ generatedMediaId, photoReferenceId: pid, inputOrder: idx })),
    })
  }

  const task = await prisma.workerTask.create({
    data: {
      type: 'GENERATE_VIDEO', capability: 'GENERATE_VIDEO',
      payloadJson: JSON.stringify({ generatedMediaId, prompt, orientation, resolution, durationSeconds, photoReferenceIds: photoRefIds, instagramAccountId: body.instagramAccountId ?? null, userId: agent.ownerUserId }),
      status: 'pending', priority: 5, maxAttempts: 2,
    },
  })

  await prisma.generatedMedia.update({ where: { id: generatedMediaId }, data: { workerTaskId: task.id } })

  return NextResponse.json({ id: generatedMediaId, status: 'queued', creditsCost, balanceRemaining: balanceAfter }, { status: 201 })
}
