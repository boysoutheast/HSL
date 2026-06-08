import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const topicId = searchParams.get('topicId')
  const productId = searchParams.get('productId')
  const characterId = searchParams.get('characterId')
  const status = searchParams.get('status')
  const source = searchParams.get('source')

  // If characterId provided, find all topics for that character
  let characterTopicIds: string[] | undefined
  if (characterId) {
    const charTopics = await prisma.topic.findMany({
      where: { characterId },
      select: { id: true },
    })
    characterTopicIds = charTopics.map(t => t.id)
  }

  // non-admin: filter via topic → character → account chain OR product
  const ownershipFilter =
    auth.role === 'admin'
      ? {}
      : {
          OR: [
            { topic: { character: { instagramAccount: { createdByUserId: auth.id } } } },
            { product: { createdByUserId: auth.id } },
          ],
        }

  const ceps = await prisma.cep.findMany({
    where: {
      ...ownershipFilter,
      ...(topicId ? { topicId } : {}),
      ...(productId ? { productId } : {}),
      ...(characterTopicIds !== undefined ? { topicId: { in: characterTopicIds } } : {}),
      ...(status ? { status } : {}),
      ...(source ? { source } : {}),
    },
    include: {
      topic: { select: { id: true, name: true } },
      product: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ ceps })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    topicId?: string
    productId?: string
    cepText: string
    painPoint?: string
    angle?: string
    source?: string
    status?: string
    notes?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.cepText) {
    return NextResponse.json({ error: 'cepText is required' }, { status: 400 })
  }

  const cep = await prisma.cep.create({
    data: {
      topicId: body.topicId,
      productId: body.productId,
      cepText: body.cepText,
      painPoint: body.painPoint,
      angle: body.angle,
      source: body.source ?? 'human',
      status: body.status ?? 'active',
      notes: body.notes,
    },
  })

  return NextResponse.json({ cep }, { status: 201 })
}
