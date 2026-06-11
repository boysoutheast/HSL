import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { graphFetch, getMetaToken, MetaGraphError } from '@/lib/meta-graph'

export const dynamic = 'force-dynamic'

const AD_FORMATS = [
  'DESKTOP_FEED_STANDARD',
  'MOBILE_FEED_STANDARD',
  'INSTAGRAM_STANDARD',
  'INSTAGRAM_STORY',
  'INSTAGRAM_REELS',
  'RIGHT_COLUMN_STANDARD',
]

// GET /api/admin/meta-tools/ad-preview?adId=...&format=INSTAGRAM_REELS
// atau ?creativeId=...
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const adId = searchParams.get('adId')
  const creativeId = searchParams.get('creativeId')
  const format = searchParams.get('format') ?? 'MOBILE_FEED_STANDARD'

  if (!adId && !creativeId) {
    return NextResponse.json({ error: 'adId or creativeId is required' }, { status: 400 })
  }
  if (!AD_FORMATS.includes(format)) {
    return NextResponse.json({ error: `format must be one of: ${AD_FORMATS.join(', ')}` }, { status: 400 })
  }

  const tokenData = await getMetaToken(auth.id, searchParams.get('metaAccountId') ?? undefined)
  if (!tokenData) {
    return NextResponse.json({ error: 'No connected Meta account with valid token' }, { status: 400 })
  }

  try {
    const path = adId ? `${adId}/previews` : `${creativeId}/previews`
    const result = await graphFetch<{ data: Array<{ body: string }> }>(path, tokenData.token, {
      params: { ad_format: format },
    })

    return NextResponse.json({
      format,
      previewHtml: result.data?.[0]?.body ?? null,
    })
  } catch (err) {
    const message = err instanceof MetaGraphError ? err.message : 'Preview failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
