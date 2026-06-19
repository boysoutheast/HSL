import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/overview
 * Admin-only. Aggregate system KPI — NO N+1, pakai groupBy/count/aggregate.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Users: count per status
  const userCounts = await prisma.adminUser.groupBy({
    by: ['status'],
    _count: { id: true },
  })
  const totalUsers = userCounts.reduce((a, u) => a + u._count.id, 0)
  const statusMap: Record<string, number> = {}
  for (const u of userCounts) statusMap[u.status] = u._count.id

  // Credits: aggregate
  const creditAgg = await prisma.adminUser.aggregate({
    _sum: { creditBalance: true },
  })
  const outstandingCredits = creditAgg._sum.creditBalance ?? 0

  // Credits consumed 30d (sum of negative amounts)
  const consumedTx = await prisma.creditTransaction.aggregate({
    _sum: { amount: true },
    where: {
      amount: { lt: 0 },
      createdAt: { gte: thirtyDaysAgo },
    },
  })
  const creditsConsumed30d = Math.abs(consumedTx._sum.amount ?? 0)

  // Credits granted 30d (sum of positive amounts)
  const grantedTx = await prisma.creditTransaction.aggregate({
    _sum: { amount: true },
    where: {
      amount: { gt: 0 },
      createdAt: { gte: thirtyDaysAgo },
    },
  })
  const creditsGranted30d = grantedTx._sum.amount ?? 0

  // Videos 30d
  const videoCounts = await prisma.generatedMedia.groupBy({
    by: ['status'],
    where: { createdAt: { gte: thirtyDaysAgo } },
    _count: { id: true },
  })
  const totalVideos30d = videoCounts.reduce((a, v) => a + v._count.id, 0)
  const succeededVids = videoCounts.find(v => v.status === 'completed')?._count.id ?? 0
  const failedVids = videoCounts.find(v => v.status === 'failed')?._count.id ?? 0
  const successRate = totalVideos30d > 0 ? Math.round((succeededVids / totalVideos30d) * 100) : 0

  // Campaigns
  const campaignCounts = await prisma.campaignSession.groupBy({
    by: ['status'],
    _count: { id: true },
  })
  const runningCamps = campaignCounts.find(c => c.status === 'RUNNING')?._count.id ?? 0
  const totalCamps = campaignCounts.reduce((a, c) => a + c._count.id, 0)

  // Spend 30d from MetricSnapshot
  const spendAgg = await prisma.metricSnapshot.aggregate({
    _sum: { spend: true },
    where: { windowEnd: { gte: thirtyDaysAgo } },
  })
  const spend30d = spendAgg._sum.spend ?? 0

  // Alerts
  const pendingApprovals = statusMap['pending'] ?? 0
  const zeroBalanceUsers = await prisma.adminUser.count({
    where: { creditBalance: 0, status: 'active' },
  })

  // Recent activity (limit 20) — combined from signups + big credit consumption + gen failures
  const recentSignups = await prisma.adminUser.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, email: true, name: true, createdAt: true },
  })

  const bigSpends = await prisma.creditTransaction.findMany({
    where: {
      amount: { lte: -5000 }, // spent 5k+ credits
      createdAt: { gte: thirtyDaysAgo },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, amount: true, reason: true, createdAt: true, user: { select: { email: true } } },
  })

  const recentFailures = await prisma.generatedMedia.findMany({
    where: { status: 'failed', createdAt: { gte: thirtyDaysAgo } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, prompt: true, createdAt: true, user: { select: { email: true } } },
  })

  const activityFeed: Array<{ type: string; userEmail: string; detail: string; at: Date }> = []

  for (const s of recentSignups) {
    activityFeed.push({ type: 'signup', userEmail: s.email ?? '?', detail: 'Mendaftar', at: s.createdAt })
  }
  for (const s of bigSpends) {
    const detail = `Memakai ${Math.abs(s.amount).toLocaleString()} kredit — ${s.reason}`
    activityFeed.push({ type: 'big_spend', userEmail: s.user?.email ?? '?', detail, at: s.createdAt })
  }
  for (const f of recentFailures) {
    activityFeed.push({ type: 'gen_failed', userEmail: f.user?.email ?? '?', detail: `Video gagal: ${f.prompt.slice(0, 50)}`, at: f.createdAt })
  }

  activityFeed.sort((a, b) => b.at.getTime() - a.at.getTime())
  const recentActivity = activityFeed.slice(0, 20)

  // Token health
  const needsReconnect = await prisma.metaAccount.count({
    where: { status: 'needs_reconnect' },
  })

  const expiringSoon = await prisma.metaAccount.count({
    where: {
      status: 'connected',
      tokenExpiry: {
        not: null,
        lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 hari
      },
    },
  })

  return NextResponse.json({
    users: {
      total: totalUsers,
      active: statusMap['active'] ?? 0,
      pending: pendingApprovals,
      suspended: statusMap['suspended'] ?? 0,
    },
    credits: {
      outstanding: outstandingCredits,
      consumed30d: creditsConsumed30d,
      granted30d: creditsGranted30d,
    },
    videos: {
      total30d: totalVideos30d,
      succeeded30d: succeededVids,
      failed30d: failedVids,
      successRate,
    },
    campaigns: {
      running: runningCamps,
      total: totalCamps,
    },
    spend30d,
    alerts: {
      pendingApprovals,
      zeroBalanceUsers,
      needsReconnect,
      expiringSoon,
    },
    recentActivity,
  })
}
