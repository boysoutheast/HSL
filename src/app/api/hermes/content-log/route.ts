import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateHermesApiKey, extractBearerToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) {
    return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
  }

  const agent = await validateHermesApiKey(token)
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401 })
  }

  let body: {
    instagramAccountId: string
    characterId?: string
    topicId?: string
    cepId?: string
    productId?: string
    referenceImageId?: string
    prompt: string
    script?: string
    caption?: string
    postUrl?: string
    videoUrl?: string
    status?: string
    errorMessage?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.instagramAccountId || !body.prompt) {
    return NextResponse.json(
      { error: 'instagramAccountId and prompt are required' },
      { status: 400 },
    )
  }

  // Verify this account is assigned to this agent
  const accountAssignment = await prisma.assignment.findFirst({
    where: {
      hermesAgentId: agent.id,
      assignableType: 'instagram_account',
      assignableId: body.instagramAccountId,
      status: 'active',
    },
  })

  if (!accountAssignment) {
    return NextResponse.json(
      { error: 'Account not assigned to this agent' },
      { status: 403 },
    )
  }

  const status = body.status ?? 'generated'
  const postedAt = status === 'posted' ? new Date() : undefined

  const contentLog = await prisma.generatedContentLog.create({
    data: {
      hermesAgentId: agent.id,
      instagramAccountId: body.instagramAccountId,
      characterId: body.characterId,
      topicId: body.topicId,
      cepId: body.cepId,
      productId: body.productId,
      referenceImageId: body.referenceImageId,
      prompt: body.prompt,
      script: body.script,
      caption: body.caption,
      postUrl: body.postUrl,
      videoUrl: body.videoUrl,
      status,
      errorMessage: body.errorMessage,
      postedAt,
    },
  })

  if (status === 'posted' && body.postUrl) {
    // Update account lastPostAt
    await prisma.instagramAccount.update({
      where: { id: body.instagramAccountId },
      data: { lastPostAt: new Date() },
    })

    // Upsert PostingMonitor to MONITORING
    await prisma.postingMonitor.upsert({
      where: { instagramAccountId: body.instagramAccountId },
      create: {
        instagramAccountId: body.instagramAccountId,
        latestContentLogId: contentLog.id,
        latestPostUrl: body.postUrl,
        lastPostAt: new Date(),
        status: 'MONITORING',
        reason: 'New post uploaded. Monitoring metrics.',
        assignedHermesId: agent.id,
      },
      update: {
        latestContentLogId: contentLog.id,
        latestPostUrl: body.postUrl,
        lastPostAt: new Date(),
        status: 'MONITORING',
        reason: 'New post uploaded. Monitoring metrics.',
        currentViews: 0,
        previousViews: 0,
        growthPerHour: 0,
        consecutiveStuckCount: 0,
        lockedUntil: null,
        assignedHermesId: agent.id,
      },
    })

    // Create PerformanceTracker
    await prisma.performanceTracker.upsert({
      where: { generatedContentLogId: contentLog.id },
      create: {
        generatedContentLogId: contentLog.id,
        instagramAccountId: body.instagramAccountId,
        postUrl: body.postUrl,
      },
      update: {
        postUrl: body.postUrl,
      },
    })
  }

  return NextResponse.json({ contentLog }, { status: 201 })
}
