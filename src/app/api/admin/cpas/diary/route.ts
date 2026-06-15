import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await requireAdmin(req)
  if (user instanceof NextResponse) return user

  const { searchParams } = new URL(req.url)
  const productKey = searchParams.get('productKey') ?? undefined
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)

  const entries = await prisma.cpasDiary.findMany({
    where: { ...(productKey && { productKey }) },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({ entries })
}
