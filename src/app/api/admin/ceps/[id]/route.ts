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

  const cep = await prisma.cep.findFirst({
    where: {
      id: params.id,
      ...(auth.role === 'admin'
        ? {}
        : { topic: { character: { instagramAccount: { createdByUserId: auth.id } } } }),
    },
    include: { topic: true, product: true },
  })

  if (!cep) {
    return NextResponse.json({ error: 'CEP not found' }, { status: 404 })
  }

  return NextResponse.json({ cep })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    topicId?: string
    productId?: string
    cepText?: string
    painPoint?: string
    angle?: string
    source?: string
    status?: string
    notes?: string
    action?: 'approve' | 'reject'
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Ownership check
  if (auth.role !== 'admin') {
    const owned = await prisma.cep.findFirst({
      where: { id: params.id, topic: { character: { instagramAccount: { createdByUserId: auth.id } } } },
      select: { id: true },
    })
    if (!owned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const resolvedStatus =
    body.action === 'approve'
      ? 'active'
      : body.action === 'reject'
        ? 'rejected'
        : body.status

  const cep = await prisma.cep.update({
    where: { id: params.id },
    data: {
      ...(body.topicId !== undefined ? { topicId: body.topicId } : {}),
      ...(body.productId !== undefined ? { productId: body.productId } : {}),
      ...(body.cepText !== undefined ? { cepText: body.cepText?.trim().slice(0, 5000) ?? undefined } : {}),
      ...(body.painPoint !== undefined ? { painPoint: body.painPoint?.trim().slice(0, 3000) ?? undefined } : {}),
      ...(body.angle !== undefined ? { angle: body.angle?.trim().slice(0, 3000) ?? undefined } : {}),
      ...(body.source !== undefined ? { source: body.source?.trim().slice(0, 200) ?? undefined } : {}),
      ...(resolvedStatus !== undefined ? { status: resolvedStatus } : {}),
      ...(body.notes !== undefined ? { notes: body.notes?.trim().slice(0, 2000) ?? undefined } : {}),
    },
  })

  return NextResponse.json({ cep })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  // Ownership check
  if (auth.role !== 'admin') {
    const owned = await prisma.cep.findFirst({
      where: { id: params.id, topic: { character: { instagramAccount: { createdByUserId: auth.id } } } },
      select: { id: true },
    })
    if (!owned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const cep = await prisma.cep.findUnique({ where: { id: params.id } })
  if (!cep) {
    return NextResponse.json({ error: 'CEP not found' }, { status: 404 })
  }

  // Null out cepId in content logs before hard delete
  await prisma.generatedContentLog.updateMany({
    where: { cepId: params.id },
    data: { cepId: null },
  })

  await prisma.cep.delete({ where: { id: params.id } })

  return NextResponse.json({ success: true })
}
