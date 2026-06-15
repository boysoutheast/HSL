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
  const killTier = searchParams.get('killTier') ?? undefined
  const minKillCount = searchParams.get('minKillCount') ? parseInt(searchParams.get('minKillCount')!) : undefined
  const since = searchParams.get('since') ? new Date(searchParams.get('since')!) : undefined
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)

  const entries = await prisma.cpasGraveyard.findMany({
    where: {
      ...(productKey && { productKey }),
      ...(killTier && { killTier }),
      ...(minKillCount && { killCount: { gte: minKillCount } }),
      ...(since && { lastKilledAt: { gte: since } }),
    },
    orderBy: { lastKilledAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({ entries })
}

export async function POST(req: NextRequest) {
  const agent = await authenticate(req)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    metaAdsetId: string
    adsetName: string
    campaignName: string
    productKey: string
    killTier: string
    killReason: string
    spendAtKill: number
    roasAtKill?: number
    catalogROASAtKill?: number
    purchasesAtKill?: number
    cplcAtKill?: number
    cepText?: string
    exchangeValue?: string
    deliveryStyle?: string
    campaignSessionId?: string
    userId: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const required = ['metaAdsetId', 'adsetName', 'campaignName', 'productKey', 'killTier', 'killReason', 'spendAtKill', 'userId']
  for (const f of required) {
    if (!body[f as keyof typeof body] && body[f as keyof typeof body] !== 0) {
      return NextResponse.json({ error: `Missing required field: ${f}` }, { status: 400 })
    }
  }

  const now = new Date()

  // Upsert by metaAdsetId — increment killCount if already killed before
  const existing = await prisma.cpasGraveyard.findFirst({
    where: { metaAdsetId: body.metaAdsetId },
    orderBy: { lastKilledAt: 'desc' },
  })

  let entry
  if (existing) {
    entry = await prisma.cpasGraveyard.update({
      where: { id: existing.id },
      data: {
        killCount: existing.killCount + 1,
        lastKilledAt: now,
        killTier: body.killTier,
        killReason: body.killReason,
        spendAtKill: body.spendAtKill,
        roasAtKill: body.roasAtKill ?? null,
        catalogROASAtKill: body.catalogROASAtKill ?? null,
        purchasesAtKill: body.purchasesAtKill ?? null,
        cplcAtKill: body.cplcAtKill ?? null,
        cepText: body.cepText ?? null,
        exchangeValue: body.exchangeValue ?? null,
        deliveryStyle: body.deliveryStyle ?? null,
      },
    })
  } else {
    entry = await prisma.cpasGraveyard.create({
      data: {
        userId: body.userId,
        campaignSessionId: body.campaignSessionId ?? null,
        metaAdsetId: body.metaAdsetId,
        adsetName: body.adsetName,
        campaignName: body.campaignName,
        productKey: body.productKey,
        killTier: body.killTier,
        killReason: body.killReason,
        spendAtKill: body.spendAtKill,
        roasAtKill: body.roasAtKill ?? null,
        catalogROASAtKill: body.catalogROASAtKill ?? null,
        purchasesAtKill: body.purchasesAtKill ?? null,
        cplcAtKill: body.cplcAtKill ?? null,
        cepText: body.cepText ?? null,
        exchangeValue: body.exchangeValue ?? null,
        deliveryStyle: body.deliveryStyle ?? null,
        firstKilledAt: now,
        lastKilledAt: now,
      },
    })
  }

  return NextResponse.json({ id: entry.id, killCount: entry.killCount }, { status: 201 })
}
