import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/admin/campaign-sessions/[id]/topup-log
 * List top-up log entries, newest first.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const session = await prisma.campaignSession.findFirst({
    where: { id: params.id, userId: auth.id },
    select: { id: true },
  })
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const logs = await prisma.campaignTopupLog.findMany({
    where: { campaignSessionId: params.id },
    orderBy: { triggeredAt: 'desc' },
    take: 50,
  })

  return NextResponse.json({ logs })
}
