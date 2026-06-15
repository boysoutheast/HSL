import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await requireAdmin(req)
  if (user instanceof NextResponse) return user

  const { searchParams } = new URL(req.url)
  const productKey = searchParams.get('productKey') ?? undefined
  const isActive = searchParams.get('isActive') !== 'false'

  const pains = await prisma.cpasPainEntry.findMany({
    where: {
      ...(productKey && { productKey }),
      isActive,
    },
    include: { product: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ pains })
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin(req)
  if (user instanceof NextResponse) return user

  let body: {
    productKey: string
    productId?: string
    painText: string
    exchangeValues?: string[]
    deliveryStyles?: string[]
    notes?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.productKey || !body.painText) {
    return NextResponse.json({ error: 'productKey and painText are required' }, { status: 400 })
  }

  const entry = await prisma.cpasPainEntry.create({
    data: {
      userId: user.id,
      productKey: body.productKey,
      productId: body.productId ?? null,
      painText: body.painText,
      exchangeValues: body.exchangeValues ?? [],
      deliveryStyles: body.deliveryStyles ?? [],
      notes: body.notes ?? null,
    },
  })

  return NextResponse.json({ entry }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const user = await requireAdmin(req)
  if (user instanceof NextResponse) return user

  let body: {
    id: string
    painText?: string
    exchangeValues?: string[]
    deliveryStyles?: string[]
    isActive?: boolean
    notes?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const entry = await prisma.cpasPainEntry.update({
    where: { id: body.id },
    data: {
      ...(body.painText !== undefined && { painText: body.painText }),
      ...(body.exchangeValues !== undefined && { exchangeValues: body.exchangeValues }),
      ...(body.deliveryStyles !== undefined && { deliveryStyles: body.deliveryStyles }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.notes !== undefined && { notes: body.notes }),
    },
  })

  return NextResponse.json({ entry })
}
