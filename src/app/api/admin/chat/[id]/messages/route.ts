import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// ── GET /api/admin/chat/[id]/messages ──────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') ?? '50')
  const before = searchParams.get('before') // ISO date string for cursor pagination

  const thread = await prisma.metaChatThread.findUnique({
    where: { id: params.id },
  })

  if (!thread) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
  }

  const where: Record<string, unknown> = {
    threadId: params.id,
  }

  // Cursor-based pagination using sentAt
  if (before) {
    where.sentAt = { lt: new Date(before) }
  }

  const [messages, total] = await Promise.all([
    prisma.metaChatMessage.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      take: limit,
    }),
    prisma.metaChatMessage.count({ where: { threadId: params.id } }),
  ])

  // Reverse for chronological order
  const sortedMessages = [...messages].reverse()

  return NextResponse.json({
    messages: sortedMessages,
    total,
    hasMore: messages.length === limit,
  })
}
