/**
 * GET /api/admin/notifications
 * List notifications for current user, latest first.
 * Query params:
 *   ?unread=true — hanya yang belum dibaca
 *   ?limit=N — max results (default 50)
 *
 * PATCH /api/admin/notifications
 * Mark notifications as read.
 * Body: { id?: string } — if id given, mark single; if omitted, mark all.
 * Scoped to user: hanya bisa mark notif milik sendiri.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await requireAuth(req)
  if (user instanceof NextResponse) return user

  const { searchParams } = new URL(req.url)
  const unread = searchParams.get('unread') === 'true'
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 200)

  try {
    const where: Record<string, unknown> = { userId: user.id }
    if (unread) where.readAt = null

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ ok: true, data: notifications })
  } catch (err) {
    console.error('[notifications] GET error:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const user = await requireAuth(req)
  if (user instanceof NextResponse) return user

  try {
    const body = await req.json().catch(() => ({}))
    const { id } = body as { id?: string }

    if (id) {
      // Mark single notification as read — must belong to user
      const result = await prisma.notification.updateMany({
        where: { id, userId: user.id, readAt: null },
        data: { readAt: new Date() },
      })
      return NextResponse.json({ ok: true, updated: result.count })
    }

    // Mark all as read
    const result = await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    })
    return NextResponse.json({ ok: true, updated: result.count })
  } catch (err) {
    console.error('[notifications] PATCH error:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
