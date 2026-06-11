import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const flag = await prisma.featureFlag.findUnique({
    where: { id: params.id },
  })

  if (!flag) {
    return NextResponse.json({ error: 'Feature flag not found' }, { status: 404 })
  }

  return NextResponse.json({ flag })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    enabled?: boolean
    config?: Record<string, unknown>
    targetId?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const existing = await prisma.featureFlag.findUnique({
    where: { id: params.id },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Feature flag not found' }, { status: 404 })
  }

  const updateData: Record<string, unknown> = {
    enabled: body.enabled ?? existing.enabled,
    targetId: body.targetId !== undefined ? body.targetId : existing.targetId,
  }
  if (body.config !== undefined) {
    updateData.config = body.config
  }

  const updated = await prisma.featureFlag.update({
    where: { id: params.id },
    data: updateData,
  })

  return NextResponse.json({ flag: updated })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const existing = await prisma.featureFlag.findUnique({
    where: { id: params.id },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Feature flag not found' }, { status: 404 })
  }

  await prisma.featureFlag.delete({
    where: { id: params.id },
  })

  return NextResponse.json({ success: true })
}
