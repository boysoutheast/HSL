import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function findOwned(id: string, auth: { id: string; role: string }) {
  return prisma.mediaLibraryRule.findFirst({
    where: { id, ...(auth.role === 'admin' ? {} : { userId: auth.id }) },
  })
}

// PATCH /api/admin/media-rules/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const rule = await findOwned(params.id, auth)
  if (!rule) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const updated = await prisma.mediaLibraryRule.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.triggerType !== undefined ? { triggerType: body.triggerType } : {}),
      ...(body.threshold !== undefined ? { threshold: Number(body.threshold) } : {}),
      ...(body.mediaType !== undefined ? { mediaType: body.mediaType } : {}),
      ...(body.actionType !== undefined ? { actionType: body.actionType } : {}),
      ...(body.taskType !== undefined ? { taskType: body.taskType } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.cooldownHours !== undefined ? { cooldownHours: body.cooldownHours } : {}),
    },
  })

  return NextResponse.json({ rule: updated })
}

// DELETE /api/admin/media-rules/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const rule = await findOwned(params.id, auth)
  if (!rule) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.mediaLibraryRule.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
