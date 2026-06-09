import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/admin/observability/actions
// Returns action health counts for the last 24 hours
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [succeeded, failed, uncertain, pending] = await Promise.all([
    prisma.automationAction.count({ where: { status: 'SUCCEEDED', createdAt: { gte: since } } }),
    prisma.automationAction.count({ where: { status: 'FAILED', createdAt: { gte: since } } }),
    prisma.automationAction.count({ where: { status: 'UNCERTAIN', createdAt: { gte: since } } }),
    prisma.automationAction.count({ where: { status: 'PENDING', createdAt: { gte: since } } }),
  ])

  const total = succeeded + failed + uncertain + pending

  return NextResponse.json({ total, succeeded, failed, uncertain, pending })
}
