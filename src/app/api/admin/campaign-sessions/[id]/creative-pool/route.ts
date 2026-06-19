import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/admin/campaign-sessions/[id]/creative-pool
 * List pool creative, scoped by session + userId.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const session = await prisma.campaignSession.findFirst({
    where: { id: params.id, userId: auth.id },
    select: { id: true },
  })
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const items = await prisma.campaignCreativePool.findMany({
    where: { campaignSessionId: params.id, userId: auth.id },
    orderBy: { sortOrder: 'asc' },
  })

  const counts = {
    available: items.filter((i) => i.status === 'available').length,
    used: items.filter((i) => i.status === 'used').length,
    failed: items.filter((i) => i.status === 'failed').length,
    archived: items.filter((i) => i.status === 'archived').length,
  }

  return NextResponse.json({ items, counts })
}

/**
 * POST /api/admin/campaign-sessions/[id]/creative-pool
 * Add a single creative to the pool.
 * Body: { primaryText*, headline?, description?, callToAction?, linkUrl?, mediaAssetId?, creativeUrl?, format? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    primaryText: string
    headline?: string
    description?: string
    callToAction?: string
    linkUrl?: string
    mediaAssetId?: string
    creativeUrl?: string
    format?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.primaryText) {
    return NextResponse.json({ error: 'primaryText is required' }, { status: 400 })
  }

  if (!body.mediaAssetId && !body.creativeUrl) {
    return NextResponse.json({ error: 'At least one of mediaAssetId or creativeUrl is required' }, { status: 422 })
  }

  const session = await prisma.campaignSession.findFirst({
    where: { id: params.id, userId: auth.id },
    select: { id: true },
  })
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  // ★ Validasi mediaAssetId kalau dikirim
  if (body.mediaAssetId) {
    const asset = await prisma.mediaAsset.findUnique({
      where: { id: body.mediaAssetId },
      select: { userId: true, type: true, status: true, fileUrl: true, publicUrl: true },
    })
    if (!asset || asset.userId !== auth.id || asset.type !== 'IMAGE' || asset.status !== 'READY' || (!asset.fileUrl && !asset.publicUrl)) {
      return NextResponse.json({ error: 'Media asset tidak valid (harus gambar milik Anda yang sudah siap)' }, { status: 422 })
    }
  }
  // Auto sortOrder = max+1
  const maxOrder = await prisma.campaignCreativePool.aggregate({
    where: { campaignSessionId: params.id },
    _max: { sortOrder: true },
  })
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1

  const item = await prisma.campaignCreativePool.create({
    data: {
      campaignSessionId: params.id,
      userId: auth.id,
      primaryText: body.primaryText.slice(0, 2000),
      headline: body.headline ?? null,
      description: body.description ?? null,
      callToAction: body.callToAction ?? 'LEARN_MORE',
      linkUrl: body.linkUrl ?? null,
      mediaAssetId: body.mediaAssetId ?? null,
      creativeUrl: body.creativeUrl ?? null,
      format: body.format ?? 'single',
      sortOrder,
    },
  })

  return NextResponse.json({ item }, { status: 201 })
}
