import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// PATCH /api/admin/landing-pages/[lpId] — update LP
export async function PATCH(
  req: NextRequest,
  { params }: { params: { lpId: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const lp = await prisma.landingPage.findUnique({
    where: { id: params.lpId },
    include: { product: { select: { createdByUserId: true } } },
  })
  if (!lp) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (auth.role !== 'admin' && lp.product.createdByUserId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { url, variant, type, label, isActive, isDefault, notes } = body

  // Jika set sebagai default, unset yang lain
  if (isDefault === true) {
    await prisma.landingPage.updateMany({
      where: { productId: lp.productId, isDefault: true, id: { not: params.lpId } },
      data: { isDefault: false },
    })
  }

  const updated = await prisma.landingPage.update({
    where: { id: params.lpId },
    data: {
      ...(url !== undefined ? { url: url.trim() } : {}),
      ...(variant !== undefined ? { variant } : {}),
      ...(type !== undefined ? { type } : {}),
      ...(label !== undefined ? { label: label?.trim() || null } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(isDefault !== undefined ? { isDefault } : {}),
      ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
    },
  })

  return NextResponse.json({ landingPage: updated })
}

// DELETE /api/admin/landing-pages/[lpId] — hapus LP
export async function DELETE(
  req: NextRequest,
  { params }: { params: { lpId: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const lp = await prisma.landingPage.findUnique({
    where: { id: params.lpId },
    include: { product: { select: { createdByUserId: true } } },
  })
  if (!lp) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (auth.role !== 'admin' && lp.product.createdByUserId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.landingPage.delete({ where: { id: params.lpId } })
  return NextResponse.json({ success: true })
}
