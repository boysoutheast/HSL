import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const monitors = await prisma.postingMonitor.findMany({
    where: status ? { status } : undefined,
    include: {
      instagramAccount: {
        select: {
          id: true,
          username: true,
          accountName: true,
          status: true,
          purpose: true,
        },
      },
      hermesAgent: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  // Also include accounts without a monitor record (never posted)
  const monitoredAccountIds = monitors.map(m => m.instagramAccountId)
  const unmonitoredAccounts = await prisma.instagramAccount.findMany({
    where: {
      id: { notIn: monitoredAccountIds },
      status: 'active',
    },
    select: {
      id: true,
      username: true,
      accountName: true,
      status: true,
      purpose: true,
      lastPostAt: true,
    },
  })

  return NextResponse.json({
    monitors,
    unmonitoredAccounts,
    summary: {
      total: monitors.length + unmonitoredAccounts.length,
      byStatus: monitors.reduce<Record<string, number>>((acc, m) => {
        acc[m.status] = (acc[m.status] ?? 0) + 1
        return acc
      }, {}),
      neverPosted: unmonitoredAccounts.length,
    },
  })
}
