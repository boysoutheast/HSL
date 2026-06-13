import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, assertOwnsAdAccount } from '@/lib/auth'
import { graphFetch, MetaGraphError } from '@/lib/meta-graph'
import { decode } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

// GET /api/admin/meta-tools/customaudiences?adAccountId=<internal id>
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const adAccountId = searchParams.get('adAccountId')
  if (!adAccountId) {
    return NextResponse.json({ error: 'adAccountId is required' }, { status: 400 })
  }

  const adAccount = await assertOwnsAdAccount(auth, adAccountId)
  if (adAccount instanceof NextResponse) return adAccount
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
      ? `${adAccount.adAccountId}/customaudiences`
      : `act_${adAccount.adAccountId}/customaudiences`

    const result = await graphFetch<{ data?: Array<{ id: string; name: string; approximate_count_lower_bound?: number; delivery_status?: unknown }> }>(path, token, {
      params: { fields: 'id,name,approximate_count_lower_bound,delivery_status', limit: '100' },
    })

    return NextResponse.json({
      audiences: (result.data ?? []).map((audience) => ({
        id: audience.id,
        name: audience.name,
        approximateCount: audience.approximate_count_lower_bound ?? null,
        deliveryStatus: audience.delivery_status ?? null,
      })),
    })
  } catch (err) {
    const message = err instanceof MetaGraphError ? err.message : 'Failed to fetch custom audiences'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
