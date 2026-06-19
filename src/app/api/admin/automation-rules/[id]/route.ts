import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/admin/automation-rules/[id]
 * Get a single rule with details.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const rule = await prisma.automationRule.findFirst({
    where: { id: params.id, userId: auth.id },
    include: {
      campaignSession: { select: { id: true, name: true } },
    },
  })

  if (!rule) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }

  return NextResponse.json({ rule })
}

/**
 * PATCH /api/admin/automation-rules/[id]
 * Update rule status (ACTIVE / PAUSED / ARCHIVED).
 * Body: { status }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: { status?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.status || !['ACTIVE', 'PAUSED', 'ARCHIVED'].includes(body.status)) {
    return NextResponse.json({ error: 'status must be ACTIVE, PAUSED, or ARCHIVED' }, { status: 400 })
  }

  const existing = await prisma.automationRule.findFirst({
    where: { id: params.id, userId: auth.id },
    select: { id: true },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }

  const rule = await prisma.automationRule.update({
    where: { id: params.id },
    data: { status: body.status },
  })

  return NextResponse.json({ rule })
}
