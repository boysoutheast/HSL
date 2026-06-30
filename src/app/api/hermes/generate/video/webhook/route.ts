import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { refundCredits } from '@/lib/credits'

export const dynamic = 'force-dynamic'

/**
 * POST /api/hermes/generate/video/webhook
 *
 * Idempotent webhook handler for video generation provider callbacks.
 * Callers may retry freely — double complete and double refund are prevented.
 *
 * Security: requires WEBHOOK_SECRET header match.
 * Body: { externalJobId, status: "completed"|"failed", videoUrl?, errorMessage? }
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  const expected = process.env.WEBHOOK_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    externalJobId: string
    status: 'completed' | 'failed'
    videoUrl?: string
    thumbnailUrl?: string
    durationSeconds?: number
    errorMessage?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.externalJobId || !body.status) {
    return NextResponse.json({ error: 'externalJobId and status required' }, { status: 400 })
  }

  const media = await prisma.generatedMedia.findUnique({
    where: { externalJobId: body.externalJobId },
    select: {
      id: true,
      userId: true,
      status: true,
      creditsCost: true,
      refundedAt: true,
      workerTaskId: true,
    },
  })

  if (!media) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // --- COMPLETED: set status + videoUrl, NEVER refund ---
  if (body.status === 'completed') {
    // Already completed — idempotent, return success
    if (media.status === 'completed') {
      return NextResponse.json({ ok: true, id: media.id, status: 'completed' })
    }

    // Guard: don't allow completed if already failed + refunded
    if (media.status === 'failed' && media.refundedAt) {
      return NextResponse.json(
        { error: 'Job already failed and refunded, cannot complete' },
        { status: 409 },
      )
    }

    await prisma.generatedMedia.update({
      where: { id: media.id },
      data: {
        status: 'completed',
        videoUrl: body.videoUrl ?? null,
        thumbnailUrl: body.thumbnailUrl ?? null,
        durationSeconds: body.durationSeconds ?? 10,
        completedAt: new Date(),
      },
    })

    // Generate mediaHash
    if (body.videoUrl) {
      const { generateMediaHash } = await import('@/lib/hash-receipt')
      const mediaHash = generateMediaHash({
        mediaId: media.id,
        userId: media.userId ?? '',
        videoUrl: body.videoUrl,
        completedAt: new Date().toISOString(),
        creditsCost: media.creditsCost ?? 0,
      })
      await prisma.generatedMedia.update({
        where: { id: media.id },
        data: { mediaHash },
      }).catch(() => {})
    }

    // Mark worker task completed
    if (media.workerTaskId) {
      await prisma.workerTask.updateMany({
        where: { id: media.workerTaskId, status: 'processing' },
        data: { status: 'completed', completedAt: new Date() },
      })
    }

    // Autolink: create MediaAsset from completed GeneratedMedia (idempotent)
    const full = await prisma.generatedMedia.findUnique({
      where: { id: media.id },
      select: { id: true, userId: true, videoUrl: true, thumbnailUrl: true,
                prompt: true, mediaType: true, mediaHash: true,
                mediaAssetId: true },
    })
    if (full && full.videoUrl && !full.mediaAssetId) {
      const asset = await prisma.mediaAsset.create({
        data: {
          userId: full.userId ?? '',
          type: full.mediaType === 'IMAGE' ? 'IMAGE' as const : 'VIDEO' as const,
          source: 'AI_GENERATED' as const,
          storageProvider: 'external',
          storagePath: full.videoUrl,
          publicUrl: full.videoUrl,
          fileUrl: full.videoUrl,
          thumbnailUrl: full.thumbnailUrl ?? null,
          mimeType: full.mediaType === 'IMAGE' ? 'image/png' : 'video/mp4',
          fileSizeBytes: 0,
          checksum: full.mediaHash ?? '',
          status: 'READY' as const,
          generationPrompt: full.prompt ?? null,
        },
      })
      await prisma.generatedMedia.update({
        where: { id: media.id },
        data: { mediaAssetId: asset.id },
      })
    }

    return NextResponse.json({ ok: true, id: media.id, status: 'completed' })
  }

  // --- FAILED: trigger idempotent refund ---
  if (body.status === 'failed') {
    // Already completed — cannot fail after success
    if (media.status === 'completed') {
      return NextResponse.json(
        { error: 'Job already completed, cannot fail' },
        { status: 409 },
      )
    }

    // Mark failed
    await prisma.generatedMedia.updateMany({
      where: { id: media.id, status: { not: 'failed' } },
      data: {
        status: 'failed',
        errorMessage: body.errorMessage ?? 'Generation failed',
      },
    })

    // Mark worker task failed
    if (media.workerTaskId) {
      await prisma.workerTask.updateMany({
        where: { id: media.workerTaskId, status: 'processing' },
        data: {
          status: 'failed',
          completedAt: new Date(),
          lastError: body.errorMessage?.slice(0, 2000) ?? 'Webhook reported failure',
        },
      })
    }

    // Idempotent refund — refundCredits checks refundedAt internally
    const refund = await refundCredits(media.id)

    return NextResponse.json({
      ok: true,
      id: media.id,
      status: 'failed',
      refunded: refund.refunded,
    })
  }

  return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
}
