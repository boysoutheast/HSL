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
  const topicId = searchParams.get('topicId')
  const instagramAccountId = searchParams.get('instagramAccountId')
  const status = searchParams.get('status')

  // non-admin: filter via parent ownership chain
  const ownershipFilter =
    auth.role === 'admin'
      ? {}
      : {
          OR: [
            { character: { instagramAccount: { createdByUserId: auth.id } } },
            { product: { createdByUserId: auth.id } },
          ],
        }

  const photos = await prisma.photoReference.findMany({
    where: {
      ...ownershipFilter,
      ...(status ? { status } : {}),
      ...(characterId ? { characterId } : {}),
      ...(productId ? { productId } : {}),
      ...(topicId ? { topicId } : {}),
      ...(instagramAccountId ? { instagramAccountId } : {}),
    },
    include: {
      character: { select: { id: true, name: true } },
      product: { select: { id: true, name: true } },
      topic: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ photos })
}
