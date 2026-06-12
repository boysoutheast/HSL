import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { graphFetch, MetaGraphError } from '@/lib/meta-graph'
import { decode } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

// GET /api/admin/meta-tools/interest-search?q=skincare&metaAccountId=<id>
// Proxy Meta adinterest search. Graceful: if Meta errors, return 502 with message.
// Ownership: metaAccount must belong to user.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  const metaAccountId = searchParams.get('metaAccountId')

  if (!q || !metaAccountId) {
    return NextResponse.json({ error: 'q and metaAccountId are required' }, { status: 400 })
  }

  // Ownership check
  const metaAccount = await prisma.metaAccount.findFirst({
    where: {
      id: metaAccountId,
      ...(auth.role === 'admin' ? {} : { userId: auth.id }),
      longLivedTokenEncrypted: { not: null },
    },
    select: { longLivedTokenEncrypted: true },
  })
  if (!metaAccount) return NextResponse.json({ error: 'Meta account not found' }, { status: 404 })

  let token: string
  try {
    token = decode(metaAccount.longLivedTokenEncrypted!)
  } catch {
    return NextResponse.json({ error: 'Token corrupt — reconnect Meta account' }, { status: 500 })
  }

  try {
    const result = await graphFetch<{
      data?: Array<{ id: string; name: string; audience_size_lower_bound?: number }>
    }>('search', token, {
      params: { type: 'adinterest', q, limit: '25' },
    })

    return NextResponse.json({ interests: result.data ?? [] })
  } catch (err) {
    const message = err instanceof MetaGraphError ? err.message : 'Failed to search interests'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
