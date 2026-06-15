import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateHermesApiKey, extractBearerToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const agent = await validateHermesApiKey(token)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const productKey = searchParams.get('productKey') ?? undefined
  const isActive = searchParams.get('isActive') !== 'false'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500)

  const pains = await prisma.cpasPainEntry.findMany({
    where: {
      ...(productKey && { productKey }),
      isActive,
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  return NextResponse.json({ pains })
}
