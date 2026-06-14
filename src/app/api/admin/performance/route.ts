import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const instagramAccountId = searchParams.get('instagramAccountId')
  const take = Math.min(parseInt(searchParams.get('take') ?? '50', 10) || 50, 200)
  const skip = Math.max(0, parseInt(searchParams.get('skip') ?? '0', 10) || 0)

  // Non-admin: hanya tracker dari akun IG miliknya
  const where = {
    ...(auth.role !== 'admin'
      ? { instagramAccount: { createdByUserId: auth.id } }
      : {}),
    ...(instagramAccountId ? { instagramAccountId } : {}),
  }

  const trackers = await prisma.performanceTracker.findMany({
    where,
    include: {
      contentLog: {
        select: {
          id: true,
          prompt: true,
          caption: true,
          postUrl: true,
          status: true,
          postedAt: true,
        },
      },
      instagramAccount: { select: { id: true, username: true } },
      snapshots: {
        orderBy: { checkedAt: 'desc' },
        take: 5,
      },
    },
    orderBy: { updatedAt: 'desc' },
    take,
    skip,
  })

  const total = await prisma.performanceTracker.count({ where })

  return NextResponse.json({ trackers, total, take, skip })
}
