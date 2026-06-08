import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const instagramAccountId = searchParams.get('instagramAccountId')
  const take = Math.min(parseInt(searchParams.get('take') ?? '50'), 200)
  const skip = parseInt(searchParams.get('skip') ?? '0')

  const trackers = await prisma.performanceTracker.findMany({
    where: {
      ...(instagramAccountId ? { instagramAccountId } : {}),
    },
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

  const total = await prisma.performanceTracker.count({
    where: instagramAccountId ? { instagramAccountId } : undefined,
  })

  return NextResponse.json({ trackers, total, take, skip })
}
