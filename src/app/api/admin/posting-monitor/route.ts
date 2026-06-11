import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  // Non-admin: hanya monitor dari akun IG miliknya
  const ownerWhere =
    auth.role !== 'admin' ? { instagramAccount: { createdByUserId: auth.id } } : {}

  const monitors = await prisma.postingMonitor.findMany({
    where: {
      ...ownerWhere,
      ...(status ? { status } : {}),
    },
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
      ...(auth.role !== 'admin' ? { createdByUserId: auth.id } : {}),
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
