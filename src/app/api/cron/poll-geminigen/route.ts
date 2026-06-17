import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pollJobStatus } from '@/lib/geminigen'
import { rehostVideo, rehostThumbnail } from '@/lib/video-rehost'
import { refundCredits } from '@/lib/credits'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TIMEOUT_MINUTES = 20
const MAX_CONCURRENT = 10

export async function GET(req: NextRequest) {
  // Auth via cron secret
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - TIMEOUT_MINUTES * 60 * 1000)

  // Cleanup queued jobs stuck with no externalJobId (submit silently failed)
  const stuckQueued = await prisma.generatedMedia.findMany({
    where: { status: 'queued', externalJobId: null, createdAt: { lt: cutoff } },
    select: { id: true },
  })
  for (const j of stuckQueued) {
    await prisma.generatedMedia.update({
      where: { id: j.id },
      data: { status: 'failed', errorMessage: 'Job never submitted — credits refunded' },
    })
    await refundCredits(j.id).catch(() => {})
  }

  const jobs = await prisma.generatedMedia.findMany({
    where: {
      status: 'processing',
      externalJobId: { not: null },
    },
    orderBy: { createdAt: 'asc' },
    take: MAX_CONCURRENT,
    select: {
      id: true,
      externalJobId: true,
      createdAt: true,
    },
  })

  const results = { polled: 0, completed: 0, failed: 0, timeout: 0, errors: 0 }

  for (const job of jobs) {
    results.polled++

    try {
      // Cek status GeminiGen DULU — kalau sudah jadi, selalu di-capture
      // berapapun umur job. Timeout hanya berlaku untuk job yang BELUM kelar.
      const status = await pollJobStatus(job.externalJobId!)

      if (status.status === 2 && status.mediaUrl) {
        // COMPLETED — download + rehost
        const videoUrl = await rehostVideo(status.mediaUrl, job.id)
        const thumbnailUrl = status.thumbnailUrl
          ? await rehostThumbnail(status.thumbnailUrl, job.id)
          : null

        await prisma.generatedMedia.update({
          where: { id: job.id },
          data: {
            status: 'completed',
            videoUrl,
            thumbnailUrl,
            completedAt: new Date(),
            errorMessage: null,
          },
        })

        // Generate mediaHash
        const { generateMediaHash } = await import('@/lib/hash-receipt')
        const media = await prisma.generatedMedia.findUnique({ where: { id: job.id }, select: { userId: true, creditsCost: true } })
        if (media?.userId) {
          const mediaHash = generateMediaHash({
            mediaId: job.id,
            userId: media.userId ?? '',
            videoUrl,
            completedAt: new Date().toISOString(),
            creditsCost: media.creditsCost ?? 0,
          })
          await prisma.generatedMedia.update({
            where: { id: job.id },
            data: { mediaHash },
          }).catch(() => {})
        }
        results.completed++

      } else if (status.status === 3) {
        // FAILED
        await prisma.generatedMedia.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            errorMessage: 'GeminiGen generation failed — credits auto-refunded',
          },
        })
        await refundCredits(job.id)
        results.failed++
      } else {
        // status === 1 (masih processing) — timeout HANYA kalau GeminiGen
        // belum kelar DAN job sudah lewat window. Job yang sudah jadi tidak
        // pernah jatuh ke sini (sudah di-handle cabang status === 2 di atas).
        if (job.createdAt < cutoff) {
          results.timeout++
          await prisma.generatedMedia.update({
            where: { id: job.id },
            data: {
              status: 'failed',
              errorMessage: `Timeout: job exceeded ${TIMEOUT_MINUTES} minutes — credits auto-refunded`,
            },
          })
          await refundCredits(job.id)
        }
        // belum lewat window → biarkan processing, di-poll lagi tick berikutnya
      }

    } catch (err) {
      results.errors++
      console.error(`[poll-geminigen] Error polling job ${job.id}:`, err)
      // Poll error (network/timeout ke GeminiGen) — JANGAN buang job.
      // Refund hanya kalau sudah lewat window; selain itu retry tick berikutnya
      // supaya hasil GeminiGen yang sudah jadi tetap bisa ke-capture.
      if (job.createdAt < cutoff) {
        results.timeout++
        await prisma.generatedMedia.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            errorMessage: `Timeout: job exceeded ${TIMEOUT_MINUTES} minutes — credits auto-refunded`,
          },
        }).catch(() => {})
        await refundCredits(job.id).catch(() => {})
      }
    }
  }

  return NextResponse.json({ ok: true, ...results, ts: new Date().toISOString() })
}
