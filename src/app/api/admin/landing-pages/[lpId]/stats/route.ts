import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function checkLpOwnership(lpId: string, auth: { id: string; role: string }) {
  const lp = await prisma.landingPage.findUnique({
    where: { id: lpId },
    include: { product: { select: { createdByUserId: true } } },
  })
  if (!lp) return null
  if (auth.role !== 'admin' && lp.product.createdByUserId !== auth.id) return null
  return lp
}

// GET /api/admin/landing-pages/[lpId]/stats — list stats + summary
export async function GET(
  req: NextRequest,
  { params }: { params: { lpId: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const lp = await checkLpOwnership(params.lpId, auth)
  if (!lp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const stats = await prisma.landingPageStat.findMany({
    where: { landingPageId: params.lpId },
    orderBy: { date: 'desc' },
    take: 90,
  })

  const totals = stats.reduce(
    (acc, s) => ({
      clicks: acc.clicks + s.clicks,
      conversions: acc.conversions + s.conversions,
      revenue: acc.revenue + s.revenue,
    }),
    { clicks: 0, conversions: 0, revenue: 0 }
  )

  return NextResponse.json({
    stats,
    summary: {
      ...totals,
      conversionRate: totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : null,
    },
  })
}

// POST /api/admin/landing-pages/[lpId]/stats — record stat (manual atau dari source)
export async function POST(
  req: NextRequest,
  { params }: { params: { lpId: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const lp = await checkLpOwnership(params.lpId, auth)
  if (!lp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const clicks = Number(body.clicks ?? 0)
  const conversions = Number(body.conversions ?? 0)
  const revenue = Number(body.revenue ?? 0)
  if (clicks < 0 || conversions < 0 || revenue < 0 || [clicks, conversions, revenue].some(isNaN)) {
    return NextResponse.json({ error: 'Values must be numbers >= 0' }, { status: 400 })
  }

  const VALID_SOURCES = ['manual', 'capi', 'organic', 'meta_ad', 'hermes_post']
  if (body.source && !VALID_SOURCES.includes(body.source)) {
    return NextResponse.json({ error: `source must be one of: ${VALID_SOURCES.join(', ')}` }, { status: 400 })
  }

  if (body.date) {
    const d = new Date(body.date)
    if (isNaN(d.getTime()) || d.getFullYear() < 2020 || d.getTime() > Date.now() + 24 * 3600 * 1000) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }
  }

  const stat = await prisma.landingPageStat.create({
    data: {
      landingPageId: params.lpId,
      source: body.source ?? 'manual',
      sourceRefId: body.sourceRefId ?? null,
      clicks,
      conversions,
      revenue,
      conversionRate: clicks > 0 ? (conversions / clicks) * 100 : null,
      ...(body.date ? { date: new Date(body.date) } : {}),
    },
  })

  return NextResponse.json({ stat }, { status: 201 })
}
