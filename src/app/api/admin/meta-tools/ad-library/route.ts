import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { graphFetch, getMetaToken, MetaGraphError } from '@/lib/meta-graph'

export const dynamic = 'force-dynamic'

// GET /api/admin/meta-tools/ad-library?q=skincare&country=ID&limit=25
// Competitive research: cari ads aktif di Meta Ad Library
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  const country = searchParams.get('country') ?? 'ID'
  const limit = Math.min(Number(searchParams.get('limit') ?? 25), 50)
  const pageId = searchParams.get('pageId')

  if (!q && !pageId) {
    return NextResponse.json({ error: 'q (search terms) or pageId is required' }, { status: 400 })
  }

  const tokenData = await getMetaToken(auth.id, searchParams.get('metaAccountId') ?? undefined)
  if (!tokenData) {
    return NextResponse.json({ error: 'No connected Meta account with valid token' }, { status: 400 })
  }

  try {
    const result = await graphFetch<{ data: unknown[]; paging?: unknown }>('ads_archive', tokenData.token, {
      params: {
        ad_active_status: 'ACTIVE',
        ad_reached_countries: JSON.stringify([country]),
        ...(q ? { search_terms: q } : {}),
        ...(pageId ? { search_page_ids: JSON.stringify([pageId]) } : {}),
        fields: 'id,page_id,page_name,ad_creative_bodies,ad_creative_link_titles,ad_creative_link_captions,ad_snapshot_url,ad_delivery_start_time,publisher_platforms',
        limit: String(limit),
      },
    })

    return NextResponse.json({ ads: result.data ?? [], paging: result.paging ?? null })
  } catch (err) {
    const message = err instanceof MetaGraphError ? err.message : 'Ad Library search failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
