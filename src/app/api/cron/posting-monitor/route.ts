import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { determineMonitorStatus } from '@/lib/posting-monitor'
import { startOfDay } from 'date-fns'

export const dynamic = 'force-dynamic'

async function run() {
  let settings = await prisma.postingMonitorSetting.findFirst({
    orderBy: { createdAt: 'asc' },
  })

  if (!settings) {
    settings = await prisma.postingMonitorSetting.create({ data: {} })
  }

  const monitorSettings = {
    checkIntervalMinutes: settings.checkIntervalMinutes,
    minimumDecisionAgeMinutes: settings.minimumDecisionAgeMinutes,
    deadEarlyAgeMinutes: settings.deadEarlyAgeMinutes,
    stuckThresholdPercentPerHour: settings.stuckThresholdPercentPerHour,
    growingThresholdPercentPerHour: settings.growingThresholdPercentPerHour,
    hotThresholdPercentPerHour: settings.hotThresholdPercentPerHour,
    stuckConfirmationCount: settings.stuckConfirmationCount,
    hotLockDurationMinutes: settings.hotLockDurationMinutes,
    maxPostPerDay: settings.maxPostPerDay,
    minimumGapUploadMinutes: settings.minimumGapUploadMinutes,
  }

  const activeAccounts = await prisma.instagramAccount.findMany({
    where: { status: 'active' },
    include: { postingMonitor: true },
  })

  const now = new Date()
  const results: Array<{
    accountId: string
    username: string
    oldStatus: string
    newStatus: string
    reason: string
  }> = []

  for (const account of activeAccounts) {
    const monitor = account.postingMonitor

    const todayStart = startOfDay(now)
    const postsToday = await prisma.generatedContentLog.count({
      where: {
        instagramAccountId: account.id,
        status: 'posted',
        postedAt: { gte: todayStart },
      },
    })

    const postAgeMinutes = monitor?.lastPostAt
      ? (now.getTime() - monitor.lastPostAt.getTime()) / (1000 * 60)
      : 0

    const { status: newStatus, reason } = determineMonitorStatus({
      postAgeMinutes,
      growthPerHour: monitor?.growthPerHour ?? 0,
      consecutiveStuckCount: monitor?.consecutiveStuckCount ?? 0,
      lockedUntil: monitor?.lockedUntil ?? null,
      lastPostAt: monitor?.lastPostAt ?? account.lastPostAt,
      postsToday,
      settings: monitorSettings,
    })

    const oldStatus = monitor?.status ?? 'NONE'

    let lockedUntil: Date | undefined
    if (newStatus === 'LOCKED_HOT' && (!monitor?.lockedUntil || monitor.lockedUntil <= now)) {
      lockedUntil = new Date(now.getTime() + monitorSettings.hotLockDurationMinutes * 60 * 1000)
    }

    await prisma.postingMonitor.upsert({
      where: { instagramAccountId: account.id },
      create: {
        instagramAccountId: account.id,
        status: newStatus,
        reason,
        ...(lockedUntil ? { lockedUntil } : {}),
      },
      update: {
        status: newStatus,
        reason,
        ...(lockedUntil ? { lockedUntil } : {}),
      },
    })

    results.push({ accountId: account.id, username: account.username, oldStatus, newStatus, reason })
  }

  return results
}

function checkAuth(req: NextRequest): boolean {
  const CRON_SECRET = process.env.CRON_SECRET
  if (!CRON_SECRET) return true

  const xSecret = req.headers.get('x-cron-secret')
  const bearer = req.headers.get('authorization')
  return xSecret === CRON_SECRET || bearer === `Bearer ${CRON_SECRET}`
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    console.warn('[posting-monitor] Unauthorized attempt')
    return NextResponse.json({ ok: false, error: 'Unauthorized', ts: new Date().toISOString() })
  }
  try {
    const results = await run()
    return NextResponse.json({ ok: true, processed: results.length, results, ts: new Date().toISOString() })
  } catch (err) {
    console.error('[posting-monitor] Error:', err)
    return NextResponse.json({ ok: false, error: String(err), ts: new Date().toISOString() })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
