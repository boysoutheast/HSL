import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateHermesApiKey, extractBearerToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST /api/hermes/tasks/[id] — update task lifecycle
// Body: { action: 'complete' | 'fail', result?: {...}, error?: string, mediaAsset?: {...} }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })

  const agent = await validateHermesApiKey(token)
  if (!agent) return NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401 })

  const task = await prisma.workerTask.findUnique({ where: { id: params.id } })
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  // Hanya worker yang claim yang boleh update
  if (task.workerId !== `hermes:${agent.id}`) {
    return NextResponse.json({ error: 'Task is not claimed by this agent' }, { status: 403 })
  }
  if (task.status !== 'processing') {
    return NextResponse.json({ error: `Task is not processing (status: ${task.status})` }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.action) return NextResponse.json({ error: 'action is required (complete | fail)' }, { status: 400 })

  if (body.action === 'fail') {
    const willRetry = task.attempts < task.maxAttempts
    const updated = await prisma.workerTask.update({
      where: { id: params.id },
      data: {
        status: willRetry ? 'pending' : 'failed',
        workerId: willRetry ? null : task.workerId,
        lastError: String(body.error ?? 'Unknown error').slice(0, 2000),
        ...(willRetry ? {} : { completedAt: new Date() }),
      },
    })
    if (!willRetry) {
      await prisma.deadLetterEntry.create({
        data: {
          workerTaskId: task.id,
          taskType: task.type,
          payloadJson: task.payloadJson,
          errorCode: 'HERMES_TASK_FAILED',
          errorMessage: String(body.error ?? 'Unknown error').slice(0, 2000),
          attemptCount: task.attempts,
        },
      })
    }
    return NextResponse.json({ task: updated, willRetry })
  }

  if (body.action !== 'complete') {
    return NextResponse.json({ error: 'action must be complete or fail' }, { status: 400 })
  }

  // Complete: optionally register MediaAsset hasil generate
  const payload = safeParse(task.payloadJson) as { userId?: string; productId?: string; characterId?: string } | null
  let mediaAssetId: string | null = null

  if (body.mediaAsset?.fileUrl && payload?.userId) {
    const ma = body.mediaAsset
    if (!ma.type || !['IMAGE', 'VIDEO'].includes(ma.type)) {
      return NextResponse.json({ error: 'mediaAsset.type must be IMAGE or VIDEO' }, { status: 400 })
    }
    if (typeof ma.fileUrl !== 'string' || !ma.fileUrl.startsWith('http')) {
      return NextResponse.json({ error: 'mediaAsset.fileUrl must be a valid URL' }, { status: 400 })
    }
    const asset = await prisma.mediaAsset.create({
      data: {
        userId: payload.userId,
        productId: payload.productId ?? null,
        characterId: payload.characterId ?? null,
        label: ma.label ?? null,
        category: ma.category ?? null,
        type: ma.type === 'IMAGE' ? 'IMAGE' : 'VIDEO',
        source: 'AI_GENERATED',
        storageProvider: 'external',
        storagePath: ma.fileUrl,
        publicUrl: ma.fileUrl,
        fileUrl: ma.fileUrl,
        thumbnailUrl: ma.thumbnailUrl ?? null,
        mimeType: ma.mimeType ?? (ma.type === 'IMAGE' ? 'image/jpeg' : 'video/mp4'),
        fileSizeBytes: Number(ma.fileSizeBytes ?? 0),
        width: ma.width ?? null,
        height: ma.height ?? null,
        duration: ma.duration ?? null,
        aspectRatio: ma.aspectRatio ?? null,
        checksum: ma.checksum ?? `hermes-${task.id}`,
        status: 'READY',
        generationPrompt: ma.generationPrompt ?? null,
        generatedByModel: ma.generatedByModel ?? null,
      },
    })
    mediaAssetId = asset.id
  }

  const [updated] = await prisma.$transaction([
    prisma.workerTask.update({
      where: { id: params.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        resultJson: body.result ? JSON.stringify(body.result) : null,
      },
    }),
    prisma.workerTaskResult.create({
      data: {
        workerTaskId: params.id,
        resultType: mediaAssetId ? 'media_asset' : 'raw',
        mediaAssetId,
        dataJson: body.result ? JSON.stringify(body.result) : null,
      },
    }),
  ])

  return NextResponse.json({ task: updated, mediaAssetId })
}

function safeParse(json: string): unknown {
  try { return JSON.parse(json) } catch { return null }
}
