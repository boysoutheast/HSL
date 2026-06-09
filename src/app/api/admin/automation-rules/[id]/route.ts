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

  const rule = await prisma.automationRule.findUnique({
    where: { id: params.id },
    include: {
      campaignSession: {
        select: { id: true, name: true },
      },
    },
  })

  if (!rule) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }

  if (rule.userId !== auth.id && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ rule })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const existing = await prisma.automationRule.findUnique({
    where: { id: params.id },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }

  if (existing.userId !== auth.id && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    status?: string
    name?: string
    description?: string
    conditionTreeJson?: Record<string, unknown>
    fireCount?: number
    lastFiredAt?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const validStatuses = ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']
  if (body.status && !validStatuses.includes(body.status)) {
    return NextResponse.json(
      { error: `status must be one of: ${validStatuses.join(', ')}` },
      { status: 400 }
    )
  }

  const updateData: Record<string, unknown> = {}
  if (body.status) updateData.status = body.status
  if (body.name) updateData.name = body.name
  if (body.description !== undefined) updateData.description = body.description
  if (body.conditionTreeJson) {
    updateData.conditionTreeJson = JSON.stringify(body.conditionTreeJson)
  }
  // Allow worker to update fireCount and lastFiredAt
  if (body.fireCount !== undefined) updateData.fireCount = body.fireCount
  if (body.lastFiredAt !== undefined) updateData.lastFiredAt = new Date(body.lastFiredAt)

  const updated = await prisma.automationRule.update({
    where: { id: params.id },
    data: updateData,
    include: {
      campaignSession: {
        select: { id: true, name: true },
      },
    },
  })

  return NextResponse.json({ rule: updated })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const existing = await prisma.automationRule.findUnique({
    where: { id: params.id },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }

  if (existing.userId !== auth.id && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Soft-delete: set status to ARCHIVED
  const updated = await prisma.automationRule.update({
    where: { id: params.id },
    data: { status: 'ARCHIVED' },
  })

  return NextResponse.json({ rule: updated })
}
