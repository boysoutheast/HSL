import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function findOwned(id: string, auth: { id: string; role: string }) {
  return prisma.metaAudience.findFirst({
    where: { id, ...(auth.role === 'admin' ? {} : { userId: auth.id }) },
  })
}

// PATCH /api/admin/meta-audiences/[id] — update metadata / sync status dari worker
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const audience = await findOwned(params.id, auth)
  if (!audience) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const updated = await prisma.metaAudience.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.metaAudienceId !== undefined ? { metaAudienceId: body.metaAudienceId } : {}),
      ...(body.sizeLowerBound !== undefined ? { sizeLowerBound: body.sizeLowerBound } : {}),
      ...(body.sizeUpperBound !== undefined ? { sizeUpperBound: body.sizeUpperBound } : {}),
      ...(body.errorMessage !== undefined ? { errorMessage: body.errorMessage } : {}),
      ...(body.status === 'READY' ? { lastSyncedAt: new Date() } : {}),
    },
  })

  return NextResponse.json({ audience: updated })
}

// DELETE /api/admin/meta-audiences/[id] — hapus record + task hapus di Meta (kalau sudah dibuat)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const audience = await findOwned(params.id, auth)
  if (!audience) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Kalau audience sudah ada di Meta, buat task delete dulu
  if (audience.metaAudienceId && audience.status === 'READY') {
    await prisma.workerTask.create({
      data: {
        type: 'delete_custom_audience',
        capability: 'automation_action',
        payloadJson: JSON.stringify({
          metaAudienceId: audience.metaAudienceId,
          userId: auth.id,
        }),
        priority: 6,
        scope: 'internal',
      },
    })
  }

  await prisma.metaAudience.update({
    where: { id: params.id },
    data: { status: 'DELETED' },
  })

  return NextResponse.json({ success: true })
}
