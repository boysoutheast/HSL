import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, ownerFilter } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const type = searchParams.get('type')
  const campaignSessionId = searchParams.get('campaignSessionId')
  const productId = searchParams.get('productId')

  const tests = await prisma.adTest.findMany({
    where: {
      ...ownerFilter(auth),
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(campaignSessionId ? { campaignSessionId } : {}),
      ...(productId ? { productId } : {}),
    },
    include: {
      variants: true,
      product: { select: { id: true, name: true } },
      campaignSession: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ tests })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    name: string
    type: string
    objective?: string
    successMetric: string
    hypothesis?: string
    productId?: string
    campaignSessionId?: string
    testLaunchId?: string
    minSpendPerVariant?: number
    autoScaleWinner?: boolean
    variants: Array<{
      label: string
      name: string
      generatedMediaId?: string
      testLaunchCreativeId?: string
      creativeVariantId?: string
      cepId?: string
      landingPageId?: string
      offerVariantId?: string
      metaAdId?: string
    }>
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.name || !body.type || !body.successMetric) {
    return NextResponse.json(
      { error: 'name, type, and successMetric are required' },
      { status: 400 },
    )
  }

  if (!body.variants || body.variants.length < 2) {
    return NextResponse.json(
      { error: 'At least 2 variants are required' },
      { status: 400 },
    )
  }

  const validTypes = ['CREATIVE', 'CEP', 'LP', 'PRICE', 'COMBINED']
  if (!validTypes.includes(body.type)) {
    return NextResponse.json(
      { error: `type must be one of: ${validTypes.join(', ')}` },
      { status: 400 },
    )
  }

  const test = await prisma.adTest.create({
    data: {
      name: body.name,
      type: body.type,
      objective: body.objective ?? 'PURCHASE',
      successMetric: body.successMetric,
      hypothesis: body.hypothesis ?? null,
      productId: body.productId ?? null,
      campaignSessionId: body.campaignSessionId ?? null,
      testLaunchId: body.testLaunchId ?? null,
      minSpendPerVariant: body.minSpendPerVariant
        ? (body.minSpendPerVariant as unknown as import('@prisma/client').Prisma.Decimal)
        : null,
      autoScaleWinner: body.autoScaleWinner ?? false,
      track: 'DIRECT',
      userId: auth.id,
      startedAt: new Date(),
      status: 'RUNNING',
      variants: {
        create: body.variants.map((v) => ({
          label: v.label,
          name: v.name,
          generatedMediaId: v.generatedMediaId ?? null,
          testLaunchCreativeId: v.testLaunchCreativeId ?? null,
          creativeVariantId: v.creativeVariantId ?? null,
          cepId: v.cepId ?? null,
          landingPageId: v.landingPageId ?? null,
          offerVariantId: v.offerVariantId ?? null,
          metaAdId: v.metaAdId ?? null,
        })),
      },
    },
    include: { variants: true },
  })

  return NextResponse.json({ test }, { status: 201 })
}
