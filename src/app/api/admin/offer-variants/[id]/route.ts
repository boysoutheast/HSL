import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const offer = await prisma.offerVariant.findUnique({
    where: { id: params.id },
    include: { product: { select: { id: true, createdByUserId: true } } },
  })
  if (!offer) {
    return NextResponse.json({ error: 'OfferVariant not found' }, { status: 404 })
  }
  if (auth.role !== 'admin' && offer.product.createdByUserId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { label?: string; price?: number; description?: string; isActive?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {}
  if (body.label !== undefined) updateData.label = body.label
  if (body.price !== undefined) updateData.price = body.price as unknown as import('@prisma/client').Prisma.Decimal
  if (body.description !== undefined) updateData.description = body.description ?? null
  if (body.isActive !== undefined) updateData.isActive = body.isActive

  const updated = await prisma.offerVariant.update({
    where: { id: params.id },
    data: updateData,
  })

  return NextResponse.json({ offer: updated })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const offer = await prisma.offerVariant.findUnique({
    where: { id: params.id },
    include: { product: { select: { id: true, createdByUserId: true } } },
  })
  if (!offer) {
    return NextResponse.json({ error: 'OfferVariant not found' }, { status: 404 })
  }
  if (auth.role !== 'admin' && offer.product.createdByUserId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.offerVariant.delete({ where: { id: params.id } })

  return NextResponse.json({ success: true })
}
