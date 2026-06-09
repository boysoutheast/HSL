import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { decode } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

// ── Meta Graph API helper ──────────────────────────────────────────
async function metaGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`)
  url.searchParams.set('access_token', token)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return fetch(url, { cache: 'no-store' })
}

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

// ── GET /api/admin/community/comments/[id]/route.ts ───────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const comment = await prisma.metaComment.findUnique({
    where: { id: params.id },
    include: {
      metaPage: { select: { pageName: true, pageId: true, igBusinessAccountId: true } },
      metaAccount: { select: { id: true, name: true, appId: true } },
    },
  })

  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ comment })
}

// ── POST /api/admin/community/comments/[id]/reply ─────────────────
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

  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: { message: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { message } = body
  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 })
  }

  // Get token from page or account
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

  if (!token) {
    return NextResponse.json({ error: 'No token available to reply' }, { status: 400 })
  }

  // Post reply via Meta Graph API
  const replyRes = await metaPost(comment.metaCommentId + '/comments', token, { message })
  const replyData = await replyRes.json()

  if (!replyRes.ok) {
    return NextResponse.json(
      { error: 'Meta API error', detail: replyData },
      { status: 502 },
    )
  }

  // Mark as replied in DB
  const updated = await prisma.metaComment.update({
    where: { id: params.id },
    data: {
      moderationState: 'replied',
      repliedAt: new Date(),
    },
  })

  return NextResponse.json({ success: true, comment: updated, metaResponse: replyData })
}