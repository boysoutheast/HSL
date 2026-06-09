import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decode, safeMetaError } from '@/lib/crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  // Validate cron secret
  const cronSecret = req.headers.get('x-cron-secret')
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // Find all pending schedules that are due
  const schedules = await prisma.metaSchedule.findMany({
    where: {
      status: 'pending',
      scheduledFor: { lte: now },
    },
    include: {
      metaAccount: true,
      metaPage: {
        select: { id: true, pageId: true, pageAccessTokenEncrypted: true },
      },
      metaPost: { select: { id: true } },
    },
  })

  const results = {
    processed: schedules.length,
    succeeded: 0,
    failed: 0,
    details: [] as Array<{ scheduleId: string; status: string; error?: string; metaPostId?: string }>,
  }

  for (const schedule of schedules) {
    // Mark as processing
    await prisma.metaSchedule.update({
      where: { id: schedule.id },
      data: { status: 'processing', attempts: schedule.attempts + 1 },
    })

    try {
      if (!schedule.metaPage?.pageAccessTokenEncrypted) {
        throw new Error('Page has no access token')
      }

      const pageAccessToken = decode(schedule.metaPage.pageAccessTokenEncrypted)
      const pageId = schedule.metaPage.pageId

      // Parse payloadJson
      let payload: Record<string, string>
      try {
        payload = JSON.parse(schedule.payloadJson)
      } catch {
        throw new Error('Invalid payloadJson')
      }

      // POST to Meta Graph API: /{pageId}/feed
      const graphRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pageAccessToken}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await graphRes.json() as { id?: string; error?: unknown }

      if (!graphRes.ok || data.error) {
        throw new Error(safeMetaError(data))
      }

      const metaPostId = data.id ?? ''

      // Create or link MetaPost
      let metaPost
      if (schedule.metaPostId) {
        // Update existing post
        metaPost = await prisma.metaPost.update({
          where: { id: schedule.metaPostId },
          data: {
            metaPostId,
            status: 'published',
            publishedAt: now,
          },
        })
      } else {
        // Create new post linked to this schedule
        metaPost = await prisma.metaPost.create({
          data: {
            metaAccountId: schedule.metaAccountId,
            metaPageId: schedule.metaPage.id,
            metaPostId,
            platform: schedule.platform,
            postType: schedule.postType,
            title: schedule.title,
            message: payload.message ?? null,
            mediaUrlsJson: payload.url ? JSON.stringify([payload.url]) : null,
            linkUrl: payload.link ?? null,
            status: 'published',
            publishedAt: now,
            rawJson: JSON.stringify(data),
          },
        })
      }

      // Mark schedule as published
      await prisma.metaSchedule.update({
        where: { id: schedule.id },
        data: {
          status: 'published',
          publishedMetaPostId: metaPost.id,
          lastError: null,
        },
      })

      results.succeeded++
      results.details.push({ scheduleId: schedule.id, status: 'published', metaPostId: metaPost.id })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'

      // Update schedule with error
      const updateData: { status: string; lastError: string; attempts: number } = {
        status: 'failed',
        lastError: errorMessage,
        attempts: schedule.attempts,
      }

      // If attempts < 3, set back to pending for retry
      if (schedule.attempts < 3) {
        updateData.status = 'pending'
      }

      await prisma.metaSchedule.update({
        where: { id: schedule.id },
        data: updateData,
      })

      results.failed++
      results.details.push({ scheduleId: schedule.id, status: 'failed', error: errorMessage })
    }
  }

  return NextResponse.json({
    ...results,
    ts: now.toISOString(),
  })
}
