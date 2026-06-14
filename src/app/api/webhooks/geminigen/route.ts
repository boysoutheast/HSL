import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GeminiGen payload:
// { event_name: "VIDEO_GENERATION_COMPLETED",
//   data: { uuid, media_url, thumbnail_url, status, used_credit } }
// status: 2 = completed, 3 = failed

function extractData(body: Record<string, any>) {
  const wrapper = body.data as Record<string, any> | undefined
  const uuid =
    (typeof wrapper?.uuid === 'string' && wrapper.uuid.trim()) ||
    (typeof body.uuid === 'string' && body.uuid.trim()) ||
    (typeof body.job_id === 'string' && body.job_id.trim()) ||
    null
  const mediaUrl =
    (typeof wrapper?.media_url === 'string' && wrapper.media_url.trim()) ||
    null
  const thumbnailUrl =
    (typeof wrapper?.thumbnail_url === 'string' && wrapper.thumbnail_url.trim()) ||
    null
  return { uuid, mediaUrl, thumbnailUrl }
}

export async function POST(req: NextRequest) {
  // Secret is OPTIONAL — GeminiGen does not send x-geminigen-secret header.
  // Validate only if BOTH are configured.
  const expectedSecret = process.env.GEMINIGEN_WEBHOOK_SECRET
  const providedSecret = req.headers.get('x-geminigen-secret')
  if (expectedSecret && providedSecret && providedSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: Record<string, any>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Extract UUID from GeminiGen payload shape
  const { uuid: externalJobId, mediaUrl, thumbnailUrl } = extractData(body)
  if (!externalJobId) {
    return NextResponse.json({ ok: true })
  }

  // UUID-based lookup — only process known jobs
  const generatedMedia = await prisma.generatedMedia.findUnique({
    where: { externalJobId },
    select: { id: true, status: true },
  })
  if (!generatedMedia) {
    return NextResponse.json({ ok: true })
  }

  // Don't re-process already completed/failed jobs
  if (generatedMedia.status !== 'processing') {
    return NextResponse.json({ ok: true, skipped: generatedMedia.status })
  }

  const rawWebhookJson = JSON.stringify(body)
  // GeminiGen status: 2=completed, 3=failed
  const numericStatus = typeof body.data?.status === 'number'
    ? body.data.status
    : typeof body.status === 'number'
      ? body.status
      : null

  if (numericStatus === 2 && mediaUrl) {
    // COMPLETED — rehost langsung (no worker)
    try {
      const { rehostVideo, rehostThumbnail } = await import('@/lib/video-rehost')
      const videoUrl = await rehostVideo(mediaUrl, generatedMedia.id)
      const finalThumb = thumbnailUrl
        ? await rehostThumbnail(thumbnailUrl, generatedMedia.id)
        : null

      await prisma.generatedMedia.update({
        where: { id: generatedMedia.id },
        data: {
          status: 'completed',
          videoUrl,
          thumbnailUrl: finalThumb,
          rawWebhookJson,
          completedAt: new Date(),
          errorMessage: null,
        },
      })
      return NextResponse.json({ ok: true, action: 'completed' })
    } catch (err) {
      console.error('[webhook/geminigen] rehost failed, will retry via cron:', err)
      await prisma.generatedMedia.update({
        where: { id: generatedMedia.id },
        data: { rawWebhookJson },
      })
      return NextResponse.json({ ok: true, action: 'rehost_pending' })
    }
  }

  if (numericStatus === 3) {
    // FAILED
    await prisma.generatedMedia.update({
      where: { id: generatedMedia.id },
      data: {
        status: 'failed',
        rawWebhookJson,
        errorMessage: 'GeminiGen reported status=failed',
      },
    })
    return NextResponse.json({ ok: true, action: 'marked_failed' })
  }

  // Intermediate status — just store payload, keep processing
  await prisma.generatedMedia.update({
    where: { id: generatedMedia.id },
    data: { rawWebhookJson },
  })
  return NextResponse.json({ ok: true })
}
