import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { graphFetch, MetaGraphError } from '@/lib/meta-graph'
import { decode } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

// GET /api/admin/meta-tools/adspixels?adAccountId=<internal id>
// Fetch real Meta pixels from ad account. Replaces hardcoded PIXEL_OPTIONS.
// Ownership check: ad account must belong to user's meta account.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const adAccountId = searchParams.get('adAccountId')
  if (!adAccountId) {
    return NextResponse.json({ error: 'adAccountId is required' }, { status: 400 })
  }

  const adAccount = await prisma.metaAdAccount.findFirst({
    where: {
      id: adAccountId,
      metaAccount: auth.role === 'admin' ? {} : { userId: auth.id },
    },
    include: {
      metaAccount: { select: { longLivedTokenEncrypted: true } },
    },
  })
  if (!adAccount) return NextResponse.json({ error: 'Ad account not found' }, { status: 404 })
  if (!adAccount.metaAccount.longLivedTokenEncrypted) {
    return NextResponse.json({ error: 'Meta account token missing — reconnect' }, { status: 400 })
  }

  let token: string
  try {
    token = decode(adAccount.metaAccount.longLivedTokenEncrypted)
  } catch {
    return NextResponse.json({ error: 'Token corrupt — reconnect Meta account' }, { status: 500 })
  }

  try {
    const path = adAccount.adAccountId.startsWith('act_')
      ? `${adAccount.adAccountId}/adspixels`
      : `act_${adAccount.adAccountId}/adspixels`

    const result = await graphFetch<{ data?: Array<{ id: string; name: string }> }>(path, token, {
      params: { fields: 'id,name', limit: '200' },
    })

    return NextResponse.json({ pixels: result.data ?? [] })
  } catch (err) {
    const message = err instanceof MetaGraphError ? err.message : 'Failed to fetch pixels'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
