import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const test = await prisma.adTest.findUnique({
    where: { id: params.id },
    include: {
      variants: true,
      product: { select: { id: true, name: true } },
      campaignSession: { select: { id: true, name: true } },
      testLaunch: { select: { id: true, name: true } },
    },
  })

  if (!test) {
    return NextResponse.json({ error: 'AdTest not found' }, { status: 404 })
  }

  if (auth.role !== 'admin' && test.userId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ test })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const existing = await prisma.adTest.findUnique({ where: { id: params.id } })
  if (!existing) {
    return NextResponse.json({ error: 'AdTest not found' }, { status: 404 })
  }
  if (auth.role !== 'admin' && existing.userId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    status?: string
    notes?: string
    hypothesis?: string
    successMetric?: string
    autoScaleWinner?: boolean
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {}

  if (body.status !== undefined) {
    const validStatuses = ['RUNNING', 'PAUSED', 'WINNER_DECLARED', 'ARCHIVED']
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 },
      )
    }
    updateData.status = body.status
  }

  if (body.notes !== undefined) updateData.notes = body.notes?.trim() ?? null
  if (body.hypothesis !== undefined) updateData.hypothesis = body.hypothesis?.trim() ?? null
  if (body.successMetric !== undefined) updateData.successMetric = body.successMetric
  if (body.autoScaleWinner !== undefined) updateData.autoScaleWinner = body.autoScaleWinner

  const test = await prisma.adTest.update({
    where: { id: params.id },
    data: updateData,
    include: { variants: true },
  })

  return NextResponse.json({ test })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const existing = await prisma.adTest.findUnique({ where: { id: params.id } })
  if (!existing) {
    return NextResponse.json({ error: 'AdTest not found' }, { status: 404 })
  }
  if (auth.role !== 'admin' && existing.userId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Soft delete — ARCHIVED
  const test = await prisma.adTest.update({
    where: { id: params.id },
    data: { status: 'ARCHIVED' },
    include: { variants: true },
  })

  return NextResponse.json({ test })
}
