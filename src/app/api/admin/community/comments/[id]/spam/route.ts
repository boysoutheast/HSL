import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// ── POST /api/admin/community/comments/[id]/spam ─────────────────
// Mark comment as spam and delete it
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const comment = await prisma.metaComment.findUnique({
    where: { id: params.id },
  })

  if (!comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  }

  // Mark as spam + deleted
  const updated = await prisma.metaComment.update({
    where: { id: params.id },
    data: {
      sentiment: 'spam',
      moderationState: 'deleted',
      deletedAt: new Date(),
    },
  })

  return NextResponse.json({ success: true, comment: updated })
}
