import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const sessionId = params.id
  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('entityType')

  // Verify session belongs to this user
  const session = await prisma.campaignSession.findFirst({
    where: { id: sessionId, userId: auth.id },
    select: { id: true },
  })
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const where: Record<string, unknown> = { campaignSessionId: sessionId }
  if (entityType) where.entityType = entityType

  const metrics = await prisma.metricSnapshot.findMany({
    where,
    orderBy: { windowEnd: 'desc' },
    take: 100,
  })

  return NextResponse.json({ metrics })
}
