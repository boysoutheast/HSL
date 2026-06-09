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

  const asset = await prisma.mediaAsset.findUnique({
    where: { id: params.id },
    include: {
      product: { select: { id: true, name: true } },
      creativeVariants: {
        where: { status: { not: 'ARCHIVED' } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!asset) {
    return NextResponse.json({ error: 'MediaAsset not found' }, { status: 404 })
  }

  if (auth.role !== 'admin' && asset.userId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ asset })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    status?: string
    publicUrl?: string
    productId?: string
    moderationStatus?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const existing = await prisma.mediaAsset.findUnique({ where: { id: params.id } })
  if (!existing) {
    return NextResponse.json({ error: 'MediaAsset not found' }, { status: 404 })
  }

  if (auth.role !== 'admin' && existing.userId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data: Record<string, unknown> = {}
  if (body.status !== undefined) data.status = body.status
  if (body.publicUrl !== undefined) data.publicUrl = body.publicUrl
  if (body.productId !== undefined) data.productId = body.productId
  if (body.moderationStatus !== undefined) data.moderationStatus = body.moderationStatus

  const asset = await prisma.mediaAsset.update({
    where: { id: params.id },
    data,
  })

  return NextResponse.json({ asset })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const existing = await prisma.mediaAsset.findUnique({ where: { id: params.id } })
  if (!existing) {
    return NextResponse.json({ error: 'MediaAsset not found' }, { status: 404 })
  }

  if (auth.role !== 'admin' && existing.userId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Soft delete — archive only
  const asset = await prisma.mediaAsset.update({
    where: { id: params.id },
    data: { status: 'ARCHIVED', archivedAt: new Date() },
  })

  return NextResponse.json({ asset })
}
