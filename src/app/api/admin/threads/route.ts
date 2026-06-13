import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/admin/threads — list threads */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const threads = await prisma.conversationThread.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 50,
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  })

  return NextResponse.json({
    threads: threads.map(t => ({
      id: t.id,
      subjectType: t.subjectType,
      subjectId: t.subjectId,
      status: t.status,
      autoContinueCount: t.autoContinueCount,
      firstMessage: t.messages[0]?.content?.slice(0, 120) ?? null,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })),
  })
}
