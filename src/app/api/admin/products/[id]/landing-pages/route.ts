import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/admin/products/[id]/landing-pages — list LP untuk produk
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const product = await prisma.product.findFirst({
    where: {
      id: params.id,
      ...(auth.role !== 'admin' ? { createdByUserId: auth.id } : {}),
    },
    select: { id: true },
  })
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const landingPages = await prisma.landingPage.findMany({
    where: { productId: params.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  })

  return NextResponse.json({ landingPages })
}

// POST /api/admin/products/[id]/landing-pages — tambah LP baru
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const product = await prisma.product.findFirst({
    where: {
      id: params.id,
      ...(auth.role !== 'admin' ? { createdByUserId: auth.id } : {}),
    },
    select: { id: true },
  })
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const body = await req.json()
  const { url, variant, type, label, isDefault, notes } = body

  if (!url?.trim()) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  // Jika isDefault = true, unset default LP lain dulu
  if (isDefault) {
    await prisma.landingPage.updateMany({
      where: { productId: params.id, isDefault: true },
      data: { isDefault: false },
    })
  }

  const lp = await prisma.landingPage.create({
    data: {
      productId: params.id,
      url: url.trim(),
      variant: variant ?? 'A',
      type: type ?? 'shopee',
      label: label?.trim() || null,
      isDefault: isDefault ?? false,
      notes: notes?.trim() || null,
    },
  })

  return NextResponse.json({ landingPage: lp }, { status: 201 })
}
