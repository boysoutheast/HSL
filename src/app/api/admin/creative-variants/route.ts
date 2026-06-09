import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, ownerFilter } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('productId')
  const status = searchParams.get('status')
  const mediaAssetId = searchParams.get('mediaAssetId')

  const where: Record<string, unknown> = {
    ...ownerFilter(auth),
    ...(productId ? { productId } : {}),
    ...(status ? { status } : {}),
    ...(mediaAssetId ? { mediaAssetId } : {}),
  }

  const variants = await prisma.creativeVariant.findMany({
    where,
    include: {
      product: { select: { id: true, name: true } },
      mediaAsset: { select: { id: true, publicUrl: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ variants })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    productId: string
    mediaAssetId: string
    name?: string
    primaryText: string
    headline: string
    description?: string
    linkUrl: string
    ctaButton: string
    status?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.productId) {
    return NextResponse.json({ error: 'productId is required' }, { status: 400 })
  }
  if (!body.mediaAssetId) {
    return NextResponse.json({ error: 'mediaAssetId is required' }, { status: 400 })
  }
  if (!body.primaryText) {
    return NextResponse.json({ error: 'primaryText is required' }, { status: 400 })
  }
  if (!body.headline) {
    return NextResponse.json({ error: 'headline is required' }, { status: 400 })
  }
  if (!body.linkUrl) {
    return NextResponse.json({ error: 'linkUrl is required' }, { status: 400 })
  }
  if (!body.ctaButton) {
    return NextResponse.json({ error: 'ctaButton is required' }, { status: 400 })
  }

  if (body.primaryText.length > 125) {
    return NextResponse.json({ error: 'primaryText must be 125 chars or less' }, { status: 400 })
  }
  if (body.headline.length > 255) {
    return NextResponse.json({ error: 'headline must be 255 chars or less' }, { status: 400 })
  }

  const variant = await prisma.creativeVariant.create({
    data: {
      userId: auth.id,
      productId: body.productId,
      mediaAssetId: body.mediaAssetId,
      name: body.name ?? `Variant ${Date.now()}`,
      primaryText: body.primaryText,
      headline: body.headline,
      description: body.description ?? null,
      linkUrl: body.linkUrl,
      ctaButton: body.ctaButton,
      status: body.status ?? 'DRAFT',
    },
  })

  return NextResponse.json({ variant }, { status: 201 })
}
