import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const characterId = searchParams.get('characterId')
  const productId = searchParams.get('productId')
  const status = searchParams.get('status')

  // non-admin: filter via character → account ownership
  const ownershipFilter =
    auth.role === 'admin'
      ? {}
      : {
          OR: [
            { character: { instagramAccount: { createdByUserId: auth.id } } },
            { product: { createdByUserId: auth.id } },
          ],
        }

  const topics = await prisma.topic.findMany({
    where: {
      ...ownershipFilter,
      ...(characterId ? { characterId } : {}),
      ...(productId ? { productId } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      character: { select: { id: true, name: true } },
      product: { select: { id: true, name: true } },
      _count: { select: { ceps: true, photoReferences: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ topics })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    name: string
    description: string
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

  if (!body.name || !body.description) {
    return NextResponse.json({ error: 'name and description are required' }, { status: 400 })
  }

  // Non-admin: topic harus terikat ke salah satu resource milik user
  // (tanpa ikatan = orphan yang nggak bisa di-trace ownership-nya)
  if (auth.role !== 'admin') {
    if (!body.instagramAccountId && !body.characterId && !body.productId) {
      return NextResponse.json(
        { error: 'Topic harus terikat ke instagramAccountId, characterId, atau productId' },
        { status: 400 }
      )
    }
    if (body.instagramAccountId) {
      const acc = await prisma.instagramAccount.findFirst({
        where: { id: body.instagramAccountId, createdByUserId: auth.id },
        select: { id: true },
      })
      if (!acc) return NextResponse.json({ error: 'Instagram account not found' }, { status: 404 })
    }
    if (body.characterId) {
      const char = await prisma.character.findFirst({
        where: { id: body.characterId, instagramAccount: { createdByUserId: auth.id } },
        select: { id: true },
      })
      if (!char) return NextResponse.json({ error: 'Character not found' }, { status: 404 })
    }
    if (body.productId) {
      const product = await prisma.product.findFirst({
        where: { id: body.productId, createdByUserId: auth.id },
        select: { id: true },
      })
      if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
  }

  const topic = await prisma.topic.create({
    data: {
      name: body.name,
      description: body.description,
      instagramAccountId: body.instagramAccountId,
      characterId: body.characterId,
      productId: body.productId,
      status: body.status ?? 'active',
    },
  })

  return NextResponse.json({ topic }, { status: 201 })
}
