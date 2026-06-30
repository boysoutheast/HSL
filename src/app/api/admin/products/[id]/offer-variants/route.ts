import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const product = await prisma.product.findUnique({
    where: { id: params.id },
    select: { id: true, createdByUserId: true },
  })
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }
  if (auth.role !== 'admin' && product.createdByUserId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const offers = await prisma.offerVariant.findMany({
    where: { productId: params.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ offers })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const product = await prisma.product.findUnique({
    where: { id: params.id },
    select: { id: true, createdByUserId: true },
  })
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }
  if (auth.role !== 'admin' && product.createdByUserId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { label: string; price: number; description?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.label || !body.price) {
    return NextResponse.json({ error: 'label and price are required' }, { status: 400 })
  }

  const offer = await prisma.offerVariant.create({
    data: {
      productId: params.id,
      label: body.label,
      price: body.price as unknown as import('@prisma/client').Prisma.Decimal,
      description: body.description ?? null,
    },
  })

  return NextResponse.json({ offer }, { status: 201 })
}
