import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateGrowthPerHour } from '@/lib/posting-monitor'

export const dynamic = 'force-dynamic'

async function run() {
  const trackers = await prisma.performanceTracker.findMany({
    include: {
      contentLog: {
        select: { id: true, postUrl: true, postedAt: true, status: true },
      },
      instagramAccount: { select: { id: true, username: true } },
      snapshots: {
        orderBy: { checkedAt: 'desc' },
        take: 2,
      },
    },
  })

  const results: Array<{
    trackerId: string
    accountUsername: string
    action: string
  }> = []

  for (const tracker of trackers) {
    console.log(
      `[fetch-metrics] Checking metrics for tracker ${tracker.id} — account: ${tracker.instagramAccount.username}`,
    )

    await prisma.performanceSnapshot.create({
      data: {
        performanceTrackerId: tracker.id,
        generatedContentLogId: tracker.generatedContentLogId,
        instagramAccountId: tracker.instagramAccountId,
        views: tracker.views,
        likes: tracker.likes,
        comments: tracker.comments,
        shares: tracker.shares,
        saves: tracker.saves,
        reach: tracker.reach,
      },
    })

    await prisma.performanceTracker.update({
      where: { id: tracker.id },
      data: { lastCheckedAt: new Date() },
    })

    const recentSnapshots = tracker.snapshots
    if (recentSnapshots.length >= 2) {
      const latest = recentSnapshots[0]
      const previous = recentSnapshots[1]
      const growthPerHour = calculateGrowthPerHour(latest.views, previous.views)

      const monitor = await prisma.postingMonitor.findUnique({
        where: { instagramAccountId: tracker.instagramAccountId },
      })

      if (monitor) {
        const isStuck = growthPerHour < 3
        const newConsecutiveStuck = isStuck ? monitor.consecutiveStuckCount + 1 : 0

        await prisma.postingMonitor.update({
          where: { id: monitor.id },
          data: {
            previousViews: monitor.currentViews,
            currentViews: latest.views,
            growthPerHour,
            consecutiveStuckCount: newConsecutiveStuck,
            lastMetricsCheckAt: new Date(),
          },
        })
      }
    }

    results.push({
      trackerId: tracker.id,
      accountUsername: tracker.instagramAccount.username,
      action: 'snapshot_recorded',
    })
  }

  return results
}

function checkAuth(req: NextRequest): boolean {
  const CRON_SECRET = process.env.CRON_SECRET
  if (!CRON_SECRET) return false // fail-closed: without secret, tolak semua

  // Accept secret via x-cron-secret header OR Authorization Bearer
  const xSecret = req.headers.get('x-cron-secret')
  const bearer = req.headers.get('authorization')
  return xSecret === CRON_SECRET || bearer === `Bearer ${CRON_SECRET}`
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    console.warn('[fetch-metrics] Unauthorized attempt')
    return NextResponse.json({ ok: false, error: 'Unauthorized', ts: new Date().toISOString() })
  }
  try {
    const results = await run()
    return NextResponse.json({ ok: true, processed: results.length, results, ts: new Date().toISOString() })
  } catch (err) {
    console.error('[fetch-metrics] Error:', err)
    return NextResponse.json({ ok: false, error: String(err), ts: new Date().toISOString() })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
