import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pollJobStatus } from '@/lib/geminigen'
import { rehostVideo, rehostThumbnail } from '@/lib/video-rehost'
import { refundCredits } from '@/lib/credits'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const STALL_MINUTES = 30  // job marked stalled AFTER this (NOT failed — preserves "failed" for GeminiGen)
const MAX_CONCURRENT = 10

export async function GET(req: NextRequest) {
  // Auth via cron secret — fail closed kalau env belum diset
  const expected = process.env.CRON_SECRET
  const secret = req.headers.get('x-cron-secret')
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - STALL_MINUTES * 60 * 1000)

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

  const results = { polled: 0, completed: 0, failed: 0, stalled: 0, still_processing: 0, timeout_and_failed: 0, errors: 0 }

  for (const job of jobs) {
    results.polled++

    try {
      // Cek status GeminiGen DULU — kalau sudah jadi, selalu di-capture
      // berapapun umur job. Stalled hanya untuk job yang BELUM kelar.
      const status = await pollJobStatus(job.externalJobId!)

      // Log non-terminal statuses for observability (Task 2)
      if (status.status !== 2 && status.status !== 3) {
        console.log(
          `[poll-geminigen] job=${job.id} uuid=${job.externalJobId} ` +
          `status=${status.status} desc="${status.statusDesc}" pct=${status.statusPercentage} ` +
          `error_code="${status.errorCode}" error_msg="${status.errorMessage}"`
        )
      }

      if (status.status === 2 && status.videoUrl) {
        // COMPLETED — download + rehost (even if beyond stall window — GeminiGen was just slow)
        const videoUrl = await rehostVideo(status.videoUrl, job.id)
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

      } else if (status.status === 3 || status.errorCode || status.errorMessage) {
        // GEMINIGEN REPORTED FAILED — this is a genuine failure, not a timeout
        const errMsg = status.errorMessage || `GeminiGen reported status=${status.status}`

        await prisma.generatedMedia.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            errorMessage: `GeminiGen generation failed: ${errMsg}`,
          },
        })
        await refundCredits(job.id)
        results.failed++

      } else {
        // status === 1 (masih processing) — stalled HANYA kalau GeminiGen
        // belum kelar DAN job sudah lewat window. Job yang sudah jadi tidak
        // pernah jatuh ke sini (sudah di-handle cabang status === 2 di atas).
        if (job.createdAt < cutoff) {
          // Stalled: processing too long in GeminiGen. NOT failed — video may still complete.
          console.log(
            `[poll-geminigen] STALLED job=${job.id} uuid=${job.externalJobId} ` +
            `created=${job.createdAt.toISOString()} ` +
            `GeminiGen processing: status=${status.status} pct=${status.statusPercentage} desc="${status.statusDesc}"`
          )
          await prisma.generatedMedia.update({
            where: { id: job.id },
            data: {
              status: 'stalled',
              errorMessage: `Stalled: job exceeded ${STALL_MINUTES} minutes in GeminiGen. status=${status.status} (${status.statusPercentage}%). No auto-refund.`,
            },
          })
          // NO auto-refund for stalled — let owner decide recovery
          results.stalled++
        } else {
          // Still within patience window — let it cook
          results.still_processing++
        }
      }

    } catch (err) {
      results.errors++
      console.error(`[poll-geminigen] Error polling job ${job.id}:`, err)
      // Network error ke GeminiGen — JANGAN auto-failed.
      // Refund hanya kalau sudah lewat window; selain itu retry tick berikutnya
      // supaya hasil GeminiGen yang sudah jadi tetap bisa ke-capture.
      if (job.createdAt < cutoff) {
        results.timeout_and_failed++
        await prisma.generatedMedia.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            errorMessage: `Timeout: job exceeded ${STALL_MINUTES} minutes with no GeminiGen response — credits auto-refunded`,
          },
        }).catch(() => {})
        await refundCredits(job.id).catch(() => {})
      }
    }
  }

  return NextResponse.json({ ok: true, ...results, ts: new Date().toISOString() })
}
