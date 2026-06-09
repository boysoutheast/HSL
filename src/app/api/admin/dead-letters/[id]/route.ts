import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/admin/dead-letters/[id] — single entry
export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  const entry = await prisma.deadLetterEntry.findUnique({ where: { id } })
  if (!entry) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ entry })
}

// PATCH /api/admin/dead-letters/[id] — update status/resolution/assignedTo
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  let body: {
    status?: string
    assignedTo?: string
    resolution?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const allowedStatuses = ['PENDING', 'REVIEWED', 'RETRIED', 'ARCHIVED']
  if (body.status && !allowedStatuses.includes(body.status)) {
    return NextResponse.json(
      { error: `status must be one of: ${allowedStatuses.join(', ')}` },
      { status: 400 }
    )
  }

  const updateData: Record<string, unknown> = {}
  if (body.status !== undefined) {
    updateData.status = body.status
    if (body.status === 'REVIEWED' || body.status === 'RETRIED' || body.status === 'ARCHIVED') {
      updateData.resolvedAt = new Date()
    }
  }
  if (body.assignedTo !== undefined) updateData.assignedTo = body.assignedTo
  if (body.resolution !== undefined) updateData.resolution = body.resolution

  const entry = await prisma.deadLetterEntry.update({
    where: { id },
    data: updateData,
  })

  return NextResponse.json({ entry })
}

// DELETE /api/admin/dead-letters/[id] — archive (soft-delete via ARCHIVED status)
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  const entry = await prisma.deadLetterEntry.findUnique({ where: { id } })
  if (!entry) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Archive instead of hard delete
  const updated = await prisma.deadLetterEntry.update({
    where: { id },
    data: { status: 'ARCHIVED', resolvedAt: new Date() },
  })

  return NextResponse.json({ entry: updated })
}
