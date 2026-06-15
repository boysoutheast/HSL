import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await requireAdmin(req)
  if (user instanceof NextResponse) return user

  const { searchParams } = new URL(req.url)
  const productKey = searchParams.get('productKey') ?? undefined
  const killTier = searchParams.get('killTier') ?? undefined
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
  const skip = (page - 1) * limit

  const [entries, total] = await Promise.all([
    prisma.cpasGraveyard.findMany({
      where: {
        ...(productKey && { productKey }),
        ...(killTier && { killTier }),
      },
      orderBy: { lastKilledAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.cpasGraveyard.count({
      where: {
        ...(productKey && { productKey }),
        ...(killTier && { killTier }),
      },
    }),
  ])

  return NextResponse.json({ entries, total, page, limit })
}
