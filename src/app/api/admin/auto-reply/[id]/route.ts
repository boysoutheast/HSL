import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// ── GET /api/admin/auto-reply/[id] ─────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const rule = await prisma.autoReplyRule.findUnique({
    where: { id: params.id },
    include: {
      metaPage: { select: { pageName: true, pageId: true } },
      metaAccount: { select: { id: true, name: true } },
    },
  })

  if (!rule) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }

  return NextResponse.json({ rule })
}

// ── PATCH /api/admin/auto-reply/[id] ───────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const rule = await prisma.autoReplyRule.findUnique({
    where: { id: params.id },
    include: { metaAccount: true },
  })

  if (!rule) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }

  // Non-admin: verify ownership
  if (auth.role !== 'admin' && rule.metaAccount.userId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    name?: string
    metaPageId?: string
    triggerType?: string
    triggerValue?: string
    responseType?: string
    responseValue?: string
    isActive?: boolean
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updated = await prisma.autoReplyRule.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.metaPageId !== undefined && { metaPageId: body.metaPageId }),
      ...(body.triggerType !== undefined && { triggerType: body.triggerType }),
      ...(body.triggerValue !== undefined && { triggerValue: body.triggerValue }),
      ...(body.responseType !== undefined && { responseType: body.responseType }),
      ...(body.responseValue !== undefined && { responseValue: body.responseValue }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
    include: {
      metaPage: { select: { pageName: true, pageId: true } },
      metaAccount: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ rule: updated })
}

// ── DELETE /api/admin/auto-reply/[id] ─────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const rule = await prisma.autoReplyRule.findUnique({
    where: { id: params.id },
    include: { metaAccount: true },
  })

  if (!rule) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  }

  // Non-admin: verify ownership
  if (auth.role !== 'admin' && rule.metaAccount.userId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.autoReplyRule.delete({ where: { id: params.id } })

  return NextResponse.json({ success: true })
}
