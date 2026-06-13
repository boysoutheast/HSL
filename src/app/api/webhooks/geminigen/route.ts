import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function extractUuid(body: Record<string, unknown>): string | null {
  const uuid = body.uuid
  const jobId = body.job_id
  if (typeof uuid === 'string' && uuid.trim()) return uuid.trim()
  if (typeof jobId === 'string' && jobId.trim()) return jobId.trim()
  return null
}

function extractErrorMessage(body: Record<string, unknown>): string | null {
  const direct = body.errorMessage ?? body.error_message ?? body.message
  return typeof direct === 'string' && direct.trim() ? direct.trim() : null
}

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.GEMINIGEN_WEBHOOK_SECRET
  const providedSecret = req.headers.get('x-geminigen-secret')

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const externalJobId = extractUuid(body)
  if (!externalJobId) {
    return NextResponse.json({ ok: true })
  }

  const generatedMedia = await prisma.generatedMedia.findUnique({
    where: { externalJobId },
    select: { id: true },
  })

  if (!generatedMedia) {
    return NextResponse.json({ ok: true })
  }

  const status = typeof body.status === 'string' ? body.status.toLowerCase() : ''
  const rawWebhookJson = JSON.stringify(body)

  if (status === 'completed') {
    const generatedVideo = Array.isArray(body.generated_video) ? body.generated_video[0] : null
    const payload = typeof generatedVideo === 'object' && generatedVideo !== null
      ? generatedVideo as Record<string, unknown>
      : {}

    const fileDownloadUrl = typeof payload.file_download_url === 'string' ? payload.file_download_url : null
    const thumbnailUrl = typeof payload.thumbnail_url === 'string' ? payload.thumbnail_url : null

    await prisma.$transaction(async (tx) => {
      await tx.generatedMedia.update({
        where: { id: generatedMedia.id },
        data: {
          status: 'ready_for_rehost',
          rawWebhookJson,
          completedAt: new Date(),
          errorMessage: null,
        },
      })

      if (fileDownloadUrl) {
        await tx.workerTask.create({
          data: {
            type: 'REHOST_VIDEO',
            payloadJson: JSON.stringify({
              generatedMediaId: generatedMedia.id,
              fileDownloadUrl,
              thumbnailUrl,
            }),
            status: 'pending',
            priority: 3,
          },
        })
      }
    })

    return NextResponse.json({ ok: true })
  }

  if (status === 'failed') {
    await prisma.generatedMedia.update({
      where: { id: generatedMedia.id },
      data: {
        status: 'failed',
        rawWebhookJson,
        errorMessage: extractErrorMessage(body),
      },
    })
  } else {
    await prisma.generatedMedia.update({
      where: { id: generatedMedia.id },
      data: { rawWebhookJson },
    })
  }

  return NextResponse.json({ ok: true })
}
