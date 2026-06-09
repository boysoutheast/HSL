import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { decode } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

// ── Meta Graph API helper ──────────────────────────────────────────
async function metaPost(path: string, token: string, body: Record<string, unknown>) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`)
  url.searchParams.set('access_token', token)
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
}

// ── POST /api/admin/community/comments/[id]/delete ─────────────────
// Mark comment as deleted in DB and attempt to delete on Meta side
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const comment = await prisma.metaComment.findUnique({
    where: { id: params.id },
    include: {
      metaPage: true,
      metaAccount: true,
    },
  })

  if (!comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  }

  // Mark as deleted in DB
  const updated = await prisma.metaComment.update({
    where: { id: params.id },
    data: {
      moderationState: 'deleted',
      deletedAt: new Date(),
    },
  })

  // Attempt to delete the comment on Meta side (best-effort)
  let metaSuccess = false
  let metaError: string | null = null

  try {
    let token = ''
    if (comment.metaPage?.pageAccessTokenEncrypted) {
      token = decode(comment.metaPage.pageAccessTokenEncrypted)
    }
    if (!token && comment.metaAccount) {
      token = decode(
        comment.metaAccount.longLivedTokenEncrypted ??
        comment.metaAccount.shortLivedTokenEncrypted ??
        '',
      )
    }

    if (token) {
      // POST /{commentId}?method=DELETE
      const deleteRes = await metaPost(
        `${comment.metaCommentId}?method=DELETE`,
        token,
        {},
      )
      const deleteData = await deleteRes.json()

      if (deleteRes.ok || deleteData?.success) {
        metaSuccess = true
      } else {
        metaError = deleteData?.error?.message ?? 'Meta API returned non-OK'
      }
    } else {
      metaError = 'No token available to delete on Meta'
    }
  } catch (e) {
    metaError = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json({
    success: true,
    comment: updated,
    metaDeleted: metaSuccess,
    metaError,
  })
}
