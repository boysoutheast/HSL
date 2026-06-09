import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/admin/creative-rotations/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const rotation = await prisma.creativeRotation.findUnique({
    where: { id: params.id },
    include: {
      campaignSession: {
        select: {
          id: true,
          name: true,
          status: true,
          userId: true,
        },
      },
      automationAction: {
        select: {
          id: true,
          actionType: true,
          status: true,
          createdAt: true,
        },
      },
      oldCreativeVariant: {
        select: {
          id: true,
          name: true,
          status: true,
          primaryText: true,
        },
      },
      newCreativeVariant: {
        select: {
          id: true,
          name: true,
          status: true,
          primaryText: true,
        },
      },
    },
  })

  if (!rotation) {
    return NextResponse.json({ error: 'Rotation not found' }, { status: 404 })
  }

  if (rotation.campaignSession.userId !== auth.id && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ rotation })
}

// PATCH /api/admin/creative-rotations/[id]
// Body: { status?, newMetaAdId?, activatedAt?, oldAdPausedAt?, completedAt? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const rotation = await prisma.creativeRotation.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      campaignSession: { select: { userId: true } },
    },
  })

  if (!rotation) {
    return NextResponse.json({ error: 'Rotation not found' }, { status: 404 })
  }

  if (rotation.campaignSession.userId !== auth.id && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    status?: string
    newMetaAdId?: string
    oldMetaAdId?: string
    activatedAt?: string
    oldAdPausedAt?: string
    completedAt?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED']
  if (body.status && !validStatuses.includes(body.status)) {
    return NextResponse.json(
      { error: `status must be one of: ${validStatuses.join(', ')}` },
      { status: 400 }
    )
  }

  const updated = await prisma.creativeRotation.update({
    where: { id: params.id },
    data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.newMetaAdId ? { newMetaAdId: body.newMetaAdId } : {}),
      ...(body.oldMetaAdId ? { oldMetaAdId: body.oldMetaAdId } : {}),
      ...(body.activatedAt ? { activatedAt: new Date(body.activatedAt) } : {}),
      ...(body.oldAdPausedAt ? { oldAdPausedAt: new Date(body.oldAdPausedAt) } : {}),
      ...(body.completedAt ? { completedAt: new Date(body.completedAt) } : {}),
    },
    include: {
      campaignSession: { select: { id: true, name: true } },
      newCreativeVariant: { select: { id: true, name: true } },
      oldCreativeVariant: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ rotation: updated })
}

// DELETE /api/admin/creative-rotations/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const rotation = await prisma.creativeRotation.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      campaignSession: { select: { userId: true } },
    },
  })

  if (!rotation) {
    return NextResponse.json({ error: 'Rotation not found' }, { status: 404 })
  }

  if (rotation.campaignSession.userId !== auth.id && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.creativeRotation.delete({ where: { id: params.id } })

  return NextResponse.json({ deleted: true })
}
