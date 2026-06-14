import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pollJobStatus } from '@/lib/geminigen'
import { rehostVideo, rehostThumbnail } from '@/lib/video-rehost'
import { refundCredits } from '@/lib/credits'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TIMEOUT_MINUTES = 20
const MAX_CONCURRENT = 5

export async function GET(req: NextRequest) {
  // Auth via cron secret
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - TIMEOUT_MINUTES * 60 * 1000)

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

    // Timeout check
    if (job.createdAt < cutoff) {
      results.timeout++
      await prisma.generatedMedia.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errorMessage: `Timeout: job exceeded ${TIMEOUT_MINUTES} minutes`,
        },
      })
      await refundCredits(job.id)
      continue
    }

    try {
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
        results.completed++

      } else if (status.status === 3) {
        // FAILED
        await prisma.generatedMedia.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            errorMessage: 'GeminiGen reported generation failed',
          },
        })
        await refundCredits(job.id)
        results.failed++
      }
      // status === 1 (still processing) → skip

    } catch (err) {
      results.errors++
      console.error(`[poll-geminigen] Error polling job ${job.id}:`, err)
      // Don't fail on poll errors — timeout handler will cleanup
    }
  }

  return NextResponse.json({ ok: true, ...results, ts: new Date().toISOString() })
}
