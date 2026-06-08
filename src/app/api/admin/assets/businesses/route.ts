import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/assets/businesses?metaAccountId=xxx
 *
 * List all MetaBusiness rows for a given metaAccountId.
 * Filters by ownership via the metaAccount relation.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const metaAccountId = searchParams.get('metaAccountId')

  if (!metaAccountId) {
    return NextResponse.json({ error: 'metaAccountId query param is required' }, { status: 400 })
  }

  // Verify ownership of the metaAccount
  const metaAccount = await prisma.metaAccount.findFirst({
    where: {
      id: metaAccountId,
      ...(auth.role === 'admin' ? {} : { userId: auth.id }),
    },
  })

  if (!metaAccount) {
    return NextResponse.json({ error: 'MetaConnection not found' }, { status: 404 })
  }

  const businesses = await prisma.metaBusiness.findMany({
    where: { metaAccountId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ businesses })
}
