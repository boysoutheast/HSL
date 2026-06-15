import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateHermesApiKey, extractBearerToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function authenticate(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) return null
  return validateHermesApiKey(token)
}

export async function GET(req: NextRequest) {
  const agent = await authenticate(req)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const productKey = searchParams.get('productKey') ?? undefined
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 100)

  const entries = await prisma.cpasDiary.findMany({
    where: { ...(productKey && { productKey }) },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({ entries })
}

export async function POST(req: NextRequest) {
  const agent = await authenticate(req)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    userId: string
    period: string
    productKey?: string
    totalSpend7d?: number
    totalPurchases7d?: number
    avgROAS7d?: number
    activeAdsets?: number
    killedThisRun?: number
    spawnedThisRun?: number
    revivedThisRun?: number
    topWinnerCep?: string
    summaryText?: string
    deltaVsPrevRun?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.userId || !body.period) {
    return NextResponse.json({ error: 'userId and period are required' }, { status: 400 })
  }

  const entry = await prisma.cpasDiary.create({
    data: {
      userId: body.userId,
      period: body.period,
      productKey: body.productKey ?? null,
      totalSpend7d: body.totalSpend7d ?? null,
      totalPurchases7d: body.totalPurchases7d ?? null,
      avgROAS7d: body.avgROAS7d ?? null,
      activeAdsets: body.activeAdsets ?? null,
      killedThisRun: body.killedThisRun ?? null,
      spawnedThisRun: body.spawnedThisRun ?? null,
      revivedThisRun: body.revivedThisRun ?? null,
      topWinnerCep: body.topWinnerCep ?? null,
      summaryText: body.summaryText ?? null,
      deltaVsPrevRun: body.deltaVsPrevRun ?? null,
    },
  })

  return NextResponse.json({ id: entry.id }, { status: 201 })
}
