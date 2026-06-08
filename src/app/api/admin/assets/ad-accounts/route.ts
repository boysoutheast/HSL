import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/assets/ad-accounts?metaAccountId=xxx
 *    or /api/admin/assets/ad-accounts?businessId=xxx
 *
 * List MetaAdAccount rows filtered by metaAccountId or businessId.
 * Filters by ownership via the metaAccount relation.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const metaAccountId = searchParams.get('metaAccountId')
  const businessId = searchParams.get('businessId')

  if (!metaAccountId && !businessId) {
    return NextResponse.json({ error: 'metaAccountId or businessId query param is required' }, { status: 400 })
  }

  let where: Record<string, unknown> = {}

  if (metaAccountId) {
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
    where.metaAccountId = metaAccountId
  }

  if (businessId) {
    // If filtering by businessId, still need to validate ownership via metaAccount
    if (metaAccountId) {
      where.businessId = businessId
    } else {
      // Need to find the metaAccountId from the businessId to check ownership
      const business = await prisma.metaBusiness.findFirst({
        where: { businessId },
        include: { metaAccount: true },
      })
      if (!business) {
        return NextResponse.json({ error: 'Business not found' }, { status: 404 })
      }
      if (auth.role !== 'admin' && business.metaAccount.userId !== auth.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      where.businessId = businessId
    }
  }

  const adAccounts = await prisma.metaAdAccount.findMany({
    where,
    include: {
      business: {
        select: {
          id: true,
          businessId: true,
          businessName: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ adAccounts })
}
