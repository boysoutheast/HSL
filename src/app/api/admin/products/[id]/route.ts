import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { unlink } from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'

const STORAGE_ROOT = process.env.STORAGE_ROOT ?? '/data/photos'

function fileKeyFromUrl(url: string | null): string | null {
  if (!url) return null
  const marker = '/api/photos/serve/'
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return url.slice(idx + marker.length)
}

async function deletePhotoFile(fileUrl: string | null) {
  const key = fileKeyFromUrl(fileUrl)
  if (!key) return
  try { await unlink(path.join(STORAGE_ROOT, key)) } catch { /* ignore */ }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      topics: { where: { status: 'active' } },
      photoReferences: { where: { status: 'active' } },
      ceps: { where: { status: 'active' } },
    },
  })

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  // non-admin: only see own products
  if (auth.role !== 'admin' && product.createdByUserId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ product })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    name?: string
    description?: string
    mainBenefit?: string
    productUrl?: string
    ingredients?: string
    usageInstruction?: string
    price?: number
    shopeeUrl?: string
    notes?: string
    status?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // non-admin: verify ownership
  if (auth.role !== 'admin') {
    const existing = await prisma.product.findFirst({
      where: { id: params.id, createdByUserId: auth.id },
    })
    if (!existing) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const product = await prisma.product.update({
    where: { id: params.id },
    data: body,
  })

  return NextResponse.json({ product })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const product = await prisma.product.findUnique({ where: { id: params.id } })
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  // non-admin: verify ownership
  if (auth.role !== 'admin') {
    if (product.createdByUserId !== auth.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // 1. Get CEPs linked to this product
  const ceps = await prisma.cep.findMany({
    where: { productId: params.id },
    select: { id: true },
  })
  const cepIds = ceps.map((c) => c.id)

  // 2. Null out cepId + productId in content logs
  if (cepIds.length > 0) {
    await prisma.generatedContentLog.updateMany({
      where: { cepId: { in: cepIds } },
      data: { cepId: null },
    })
  }
  await prisma.generatedContentLog.updateMany({
    where: { productId: params.id },
    data: { productId: null },
  })

  // 3. Hard delete CEPs
  await prisma.cep.deleteMany({ where: { productId: params.id } })

  // 4. Delete product photos (DB + files)
  const photos = await prisma.photoReference.findMany({ where: { productId: params.id } })
  await prisma.photoReference.deleteMany({ where: { productId: params.id } })
  for (const photo of photos) {
    await deletePhotoFile(photo.fileUrl)
    await deletePhotoFile(photo.thumbnailUrl)
  }

  // 5. Hard delete product
  await prisma.product.delete({ where: { id: params.id } })

  return NextResponse.json({ success: true })
}
