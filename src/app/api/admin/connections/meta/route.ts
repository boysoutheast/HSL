/**
 * GET /api/admin/connections/meta
 * List Meta connections for current user with token status.
 * Status pill: 🟢 connected · 🟡 expiring_soon · 🔴 needs_reconnect/expired
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await requireAuth(req)
  if (user instanceof NextResponse) return user

  const accounts = await prisma.metaAccount.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      adAccounts: {
        select: { id: true, adAccountName: true, adAccountId: true },
      },
    },
  })

  const now = new Date()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const connections = accounts.map(a => {
    const expiringSoon = a.status === 'connected' && a.tokenExpiry && a.tokenExpiry < sevenDaysFromNow
    return {
      id: a.id,
      name: a.name ?? 'Meta Connection',
      appId: a.appId,
      metaUserId: a.metaUserId,
      metaUserName: a.metaUserName,
      status: expiringSoon ? 'expiring_soon' : a.status,
      tokenExpiry: a.tokenExpiry?.toISOString() ?? null,
      lastTokenCheckAt: a.lastTokenCheckAt?.toISOString() ?? null,
      lastMetaCallAt: a.lastMetaCallAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      adAccounts: a.adAccounts.map(acc => ({
        id: acc.adAccountId,
        name: acc.adAccountName ?? 'Ad Account',
      })),
    }
  })

  return NextResponse.json({ connections })
}
