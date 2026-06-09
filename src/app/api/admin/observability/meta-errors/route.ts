import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/admin/observability/meta-errors
// Returns recent Meta API errors from AutomationAction
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const errors = await prisma.automationAction.findMany({
    where: {
      errorCode: { not: null },
      createdAt: { gte: since },
    },
    select: {
      id: true,
      actionType: true,
      errorCode: true,
      errorMessage: true,
      status: true,
      requestedAt: true,
      campaignSession: {
        select: { id: true, name: true },
      },
    },
    orderBy: { requestedAt: 'desc' },
    take: 50,
  })

  const totalCount = await prisma.automationAction.count({
    where: { errorCode: { not: null }, createdAt: { gte: since } },
  })

  const errorRate = await prisma.automationAction.count({
    where: { createdAt: { gte: since } },
  }).then(total => total > 0 ? Math.round((totalCount / total) * 100) : 0)

  return NextResponse.json({ errors, totalCount, errorRate })
}
