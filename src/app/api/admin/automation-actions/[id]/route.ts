import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const action = await prisma.automationAction.findUnique({
    where: { id: params.id },
    include: {
      campaignSession: { select: { id: true, name: true } },
      ruleExecution: { select: { id: true } },
    },
  })

  if (!action) {
    return NextResponse.json({ error: 'Action not found' }, { status: 404 })
  }

  if (action.userId !== auth.id && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ action })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: { status?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Only allow cancellation of PENDING actions
  if (body.status && body.status !== 'CANCELLED') {
    return NextResponse.json(
      { error: 'Only status=CANCELLED is allowed via this endpoint' },
      { status: 400 }
    )
  }

  const existing = await prisma.automationAction.findUnique({
    where: { id: params.id },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Action not found' }, { status: 404 })
  }

  if (existing.userId !== auth.id && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (existing.status !== 'PENDING') {
    return NextResponse.json(
      { error: 'Only PENDING actions can be cancelled' },
      { status: 409 }
    )
  }

  const updated = await prisma.automationAction.update({
    where: { id: params.id },
    data: { status: 'CANCELLED' },
    include: {
      campaignSession: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ action: updated })
}
