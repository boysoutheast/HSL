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

  const variant = await prisma.creativeVariant.findUnique({
    where: { id: params.id },
    include: {
      product: { select: { id: true, name: true } },
      mediaAsset: { select: { id: true, publicUrl: true, status: true } },
    },
  })

  if (!variant) {
    return NextResponse.json({ error: 'CreativeVariant not found' }, { status: 404 })
  }

  if (auth.role !== 'admin' && variant.userId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ variant })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    name?: string
    primaryText?: string
    headline?: string
    description?: string
    linkUrl?: string
    ctaButton?: string
    status?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const existing = await prisma.creativeVariant.findUnique({ where: { id: params.id } })
  if (!existing) {
    return NextResponse.json({ error: 'CreativeVariant not found' }, { status: 404 })
  }

  if (auth.role !== 'admin' && existing.userId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (body.primaryText && body.primaryText.length > 125) {
    return NextResponse.json({ error: 'primaryText must be 125 chars or less' }, { status: 400 })
  }
  if (body.headline && body.headline.length > 255) {
    return NextResponse.json({ error: 'headline must be 255 chars or less' }, { status: 400 })
  }

  const variant = await prisma.creativeVariant.update({
    where: { id: params.id },
    data: body,
  })

  return NextResponse.json({ variant })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const existing = await prisma.creativeVariant.findUnique({ where: { id: params.id } })
  if (!existing) {
    return NextResponse.json({ error: 'CreativeVariant not found' }, { status: 404 })
  }

  if (auth.role !== 'admin' && existing.userId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Soft delete — archive only
  const variant = await prisma.creativeVariant.update({
    where: { id: params.id },
    data: { status: 'ARCHIVED' },
  })

  return NextResponse.json({ variant })
}
