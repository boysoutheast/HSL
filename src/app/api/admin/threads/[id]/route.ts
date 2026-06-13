import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/admin/threads/:id — single thread detail */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await ctx.params

  const thread = await prisma.conversationThread.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!thread) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
  }

  return NextResponse.json({
    thread: {
      id: thread.id,
      subjectType: thread.subjectType,
      subjectId: thread.subjectId,
      status: thread.status,
      autoContinueCount: thread.autoContinueCount,
      maxAutoContinue: thread.maxAutoContinue,
      telegramChatId: thread.telegramChatId,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      messages: thread.messages.map(m => ({
        id: m.id,
        role: m.role,
        kind: m.kind,
        content: m.content,
        metadataJson: m.metadataJson,
        eventId: m.eventId,
        createdAt: m.createdAt,
      })),
    },
  })
}
