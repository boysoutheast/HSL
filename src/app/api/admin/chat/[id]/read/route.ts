import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// ── POST /api/admin/chat/[id]/read ─────────────────────────────────
// Mark a chat thread as read
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const thread = await prisma.metaChatThread.findUnique({
    where: { id: params.id },
  })

  if (!thread) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
  }

  const now = new Date()

  // Mark thread as read and update lastSyncedAt
  const updated = await prisma.metaChatThread.update({
    where: { id: params.id },
    data: {
      unreadCount: 0,
      lastSyncedAt: now,
    },
  })

  // Mark all unread inbound messages as read
  await prisma.metaChatMessage.updateMany({
    where: {
      threadId: params.id,
      direction: 'inbound',
      readAt: null,
    },
    data: { readAt: now },
  })

  return NextResponse.json({ success: true, thread: updated })
}
