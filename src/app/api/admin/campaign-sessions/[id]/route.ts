import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const session = await prisma.campaignSession.findFirst({
    where: { id: params.id, userId: auth.id },
    include: {
      metaAdAccount: { select: { id: true, adAccountId: true, adAccountName: true } },
      metaEntities: { orderBy: { entityType: 'asc' } },
      automationRules: { select: { id: true } },
      automationActions: { orderBy: { requestedAt: 'desc' }, take: 10 },
    },
  })

  if (!session) {
    return NextResponse.json({ error: 'Campaign session not found' }, { status: 404 })
  }

  const latestSnapshot = await prisma.metricSnapshot.findFirst({
    where: { campaignSessionId: params.id, entityType: 'CAMPAIGN' },
    orderBy: { windowEnd: 'desc' },
  })

  return NextResponse.json({
    session: {
      ...session,
      automationRulesCount: session.automationRules.length,
      latestSnapshot,
    },
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: { status?: string; phase?: string; automationEnabled?: boolean }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const existing = await prisma.campaignSession.findFirst({
    where: { id: params.id, userId: auth.id },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Campaign session not found' }, { status: 404 })
  }

  const updateData: Record<string, unknown> = {}
  if (body.status !== undefined) updateData.status = body.status
  if (body.phase !== undefined) updateData.phase = body.phase
  if (body.automationEnabled !== undefined) updateData.automationEnabled = body.automationEnabled

  const session = await prisma.campaignSession.update({
    where: { id: params.id },
    data: updateData,
  })

  return NextResponse.json({ session })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const existing = await prisma.campaignSession.findFirst({
    where: { id: params.id, userId: auth.id },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Campaign session not found' }, { status: 404 })
  }

  const session = await prisma.campaignSession.update({
    where: { id: params.id },
    data: { status: 'KILLED' },
  })

  return NextResponse.json({ session })
}
