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

  const topic = await prisma.topic.findFirst({
    where: {
      id: params.id,
      ...(auth.role === 'admin'
        ? {}
        : { character: { instagramAccount: { createdByUserId: auth.id } } }),
    },
    include: {
      character: true,
      product: true,
      ceps: { where: { status: 'active' } },
      photoReferences: { where: { status: 'active' } },
    },
  })

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  return NextResponse.json({ topic })
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
    instagramAccountId?: string
    characterId?: string
    productId?: string
    status?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Ownership check
  if (auth.role !== 'admin') {
    const owned = await prisma.topic.findFirst({
      where: { id: params.id, character: { instagramAccount: { createdByUserId: auth.id } } },
      select: { id: true },
    })
    if (!owned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updateData: Record<string, unknown> = {}
  if (body.name !== undefined) updateData.name = body.name?.trim().slice(0, 200) ?? undefined
  if (body.description !== undefined) updateData.description = body.description?.trim().slice(0, 2000) ?? undefined
  if (body.instagramAccountId !== undefined) updateData.instagramAccountId = body.instagramAccountId
  if (body.characterId !== undefined) updateData.characterId = body.characterId
  if (body.productId !== undefined) updateData.productId = body.productId
  if (typeof body.status === 'string' && ['active', 'inactive'].includes(body.status)) {
    updateData.status = body.status
  }

  const topic = await prisma.topic.update({
    where: { id: params.id },
    data: updateData,
  })

  return NextResponse.json({ topic })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  // Ownership check
  if (auth.role !== 'admin') {
    const owned = await prisma.topic.findFirst({
      where: { id: params.id, character: { instagramAccount: { createdByUserId: auth.id } } },
      select: { id: true },
    })
    if (!owned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get all CEPs in this topic
  const ceps = await prisma.cep.findMany({
    where: { topicId: params.id },
    select: { id: true },
  })
  const cepIds = ceps.map((c) => c.id)

  // Null out cepId in content logs
  if (cepIds.length > 0) {
    await prisma.generatedContentLog.updateMany({
      where: { cepId: { in: cepIds } },
      data: { cepId: null },
    })
  }

  // Null out topicId in content logs
  await prisma.generatedContentLog.updateMany({
    where: { topicId: params.id },
    data: { topicId: null },
  })

  // Hard delete CEPs
  await prisma.cep.deleteMany({ where: { topicId: params.id } })

  // Null out topicId in photo references (photos remain, just unlinked)
  await prisma.photoReference.updateMany({
    where: { topicId: params.id },
    data: { topicId: null },
  })

  // Hard delete topic
  await prisma.topic.delete({ where: { id: params.id } })

  return NextResponse.json({ success: true })
}
