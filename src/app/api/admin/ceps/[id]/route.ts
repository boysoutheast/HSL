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

  const cep = await prisma.cep.findUnique({
    where: { id: params.id },
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
      ...(body.cepText !== undefined ? { cepText: body.cepText } : {}),
      ...(body.painPoint !== undefined ? { painPoint: body.painPoint } : {}),
      ...(body.angle !== undefined ? { angle: body.angle } : {}),
      ...(body.source !== undefined ? { source: body.source } : {}),
      ...(resolvedStatus !== undefined ? { status: resolvedStatus } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
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
