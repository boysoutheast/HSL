import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/admin/campaign-sessions/[id]/creative-pool/bulk
 * Add multiple creatives at once. Max 50 per request.
 * Body: { items: [{ primaryText*, headline?, description?, callToAction?, linkUrl?, mediaAssetId?, creativeUrl?, format? }] }
 */
export async function POST(
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

  let body: {
    items: Array<{
      primaryText: string
      headline?: string
      description?: string
      callToAction?: string
      linkUrl?: string
      mediaAssetId?: string
      creativeUrl?: string
      format?: string
    }>
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'items array is required (min 1)' }, { status: 400 })
  }

  if (body.items.length > 50) {
    return NextResponse.json({ error: 'Max 50 items per request' }, { status: 400 })
  }

  // Validate all items first
  for (let i = 0; i < body.items.length; i++) {
    const item = body.items[i]
    if (!item.primaryText) {
      return NextResponse.json({ error: `items[${i}].primaryText is required` }, { status: 400 })
    }
    if (!item.mediaAssetId && !item.creativeUrl) {
      return NextResponse.json({ error: `items[${i}]: at least one of mediaAssetId or creativeUrl required` }, { status: 422 })
    }
  }

  // Get starting sortOrder
  const maxOrder = await prisma.campaignCreativePool.aggregate({
    where: { campaignSessionId: params.id },
    _max: { sortOrder: true },
  })
  let sortOrder = (maxOrder._max.sortOrder ?? -1) + 1

  // Create all items
  const created = await Promise.all(
    body.items.map((item) =>
      prisma.campaignCreativePool.create({
        data: {
          campaignSessionId: params.id,
          userId: auth.id,
          primaryText: item.primaryText.slice(0, 2000),
          headline: item.headline ?? null,
          description: item.description ?? null,
          callToAction: item.callToAction ?? 'LEARN_MORE',
          linkUrl: item.linkUrl ?? null,
          mediaAssetId: item.mediaAssetId ?? null,
          creativeUrl: item.creativeUrl ?? null,
          format: item.format ?? 'single',
          sortOrder: sortOrder++,
        },
      })
    ),
  )

  return NextResponse.json({ items: created, count: created.length }, { status: 201 })
}
