import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/media-assets/[id]/create-creative
 * Create a DRAFT CreativeVariant from a MediaAsset (one-click "Jadikan Creative")
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const asset = await prisma.mediaAsset.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, productId: true, publicUrl: true,
              generationPrompt: true, label: true },
  })
  if (!asset) {
    return NextResponse.json({ error: 'MediaAsset not found' }, { status: 404 })
  }
  if (auth.role !== 'admin' && asset.userId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!asset.productId) {
    return NextResponse.json({ error: 'MediaAsset must have a productId' }, { status: 400 })
  }

  const variant = await prisma.creativeVariant.create({
    data: {
      userId: auth.id,
      productId: asset.productId,
      mediaAssetId: asset.id,
      name: `${asset.label ?? 'Creative'} ${Date.now()}`,
      primaryText: '',
      headline: '',
      linkUrl: '',
      ctaButton: '',
      status: 'DRAFT',
    },
  })

  return NextResponse.json({ variant }, { status: 201 })
}
