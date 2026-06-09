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

// ── GET /api/admin/community/comments ─────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const pageId = searchParams.get('pageId')
  const state = searchParams.get('state') ?? 'pending'
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '30')

  // Build where clause
  const where: Record<string, unknown> = {}
  if (pageId) where.metaPageId = pageId
  if (state !== 'all') {
    where.moderationState = state
  }

  const [comments, total] = await Promise.all([
    prisma.metaComment.findMany({
      where,
      orderBy: { commentedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        metaPage: { select: { pageName: true, pageId: true } },
        metaAccount: { select: { id: true, name: true } },
      },
    }),
    prisma.metaComment.count({ where }),
  ])

  // Stats per state
  const [pendingCount, repliedCount, deletedCount] = await Promise.all([
    prisma.metaComment.count({ where: { ...where, moderationState: 'pending' } }),
    prisma.metaComment.count({ where: { ...where, moderationState: 'replied' } }),
    prisma.metaComment.count({ where: { ...where, moderationState: 'deleted' } }),
  ])

  return NextResponse.json({
    comments,
    total,
    page,
    pages: Math.ceil(total / limit),
    stats: { pending: pendingCount, replied: repliedCount, deleted: deletedCount },
  })
}

// ── POST /api/admin/community/comments/fetch ───────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: { metaAccountId?: string; pageId?: string } = {}
  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
  }

  let { metaAccountId, pageId } = body

  // Fallback to first connected account if omitted (for simple UI form action)
  if (!metaAccountId) {
    const first = await prisma.metaAccount.findFirst({
      where: auth.role === 'admin' ? {} : { userId: auth.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    metaAccountId = first?.id
  }

  if (!metaAccountId) {
    return NextResponse.json({ error: 'No Meta account found. Connect Meta account first.' }, { status: 400 })
  }

  // Load MetaAccount with token
  const metaAccount = await prisma.metaAccount.findFirst({
    where: {
      id: metaAccountId,
      ...(auth.role === 'admin' ? {} : { userId: auth.id }),
    },
  })
  if (!metaAccount) {
    return NextResponse.json({ error: 'Meta account not found' }, { status: 404 })
  }

  const token = decode(
    metaAccount.longLivedTokenEncrypted ?? metaAccount.shortLivedTokenEncrypted ?? '',
  )
  if (!token) {
    return NextResponse.json({ error: 'No token for this account' }, { status: 400 })
  }

  // Determine which pages to fetch
  let pageIds: string[] = []
  if (pageId) {
    pageIds = [pageId]
  } else {
    const pages = await prisma.metaPage.findMany({
      where: { metaAccountId, isActive: true },
      select: { pageId: true },
    })
    pageIds = pages.map(p => p.pageId)
  }

  if (pageIds.length === 0) {
    return NextResponse.json({ error: 'No pages found to fetch comments from' }, { status: 400 })
  }

  const now = new Date()
  const results: { pageId: string; pageName: string; fetched: number; errors: string[] }[] = []

  for (const pid of pageIds) {
    try {
      // Get page info
      const pageInfoRes = await metaGet(pid, token, { fields: 'name' })
      const pageName = pageInfoRes.ok ? (await pageInfoRes.json()).name ?? pid : pid

      // Fetch comments from recent posts
      const postsRes = await metaGet(pid, token, {
        fields: 'id,name,full_picture,message,created_time,type',
        type: 'posts',
        limit: '10',
      })
      const postsData = await postsRes.json()
      const posts = postsData?.data ?? []

      let fetched = 0
      for (const post of posts) {
        try {
          const commentsRes = await metaGet(`${post.id}/comments`, token, {
            fields: 'id,from,message,created_time,parent,attachment',
            summary: '1',
            limit: '50',
          })
          if (!commentsRes.ok) continue

          const commentsData = await commentsRes.json()
          const comments: Array<{
            id: string
            from?: { id: string; name: string }
            message?: string
            created_time: string
            parent?: { id: string }
          }> = commentsData?.data ?? []

          for (const c of comments) {
            if (!c.message || c.parent?.id) continue // skip replies to comments, keep only top-level

            const metaPage = await prisma.metaPage.findFirst({
              where: { metaAccountId, pageId: pid },
            })

            await prisma.metaComment.upsert({
              where: {
                metaAccountId_metaCommentId: {
                  metaAccountId,
                  metaCommentId: c.id,
                },
              },
              update: {
                message: c.message,
                authorName: c.from?.name ?? null,
                authorMetaId: c.from?.id ?? null,
                commentedAt: c.created_time ? new Date(c.created_time) : null,
                metaPageId: metaPage?.id ?? null,
                metaPostId: post.id,
                fetchedAt: now,
                rawJson: JSON.stringify(c),
              },
              create: {
                metaAccountId,
                metaCommentId: c.id,
                metaPageId: metaPage?.id ?? null,
                metaPostId: post.id,
                authorName: c.from?.name ?? null,
                authorMetaId: c.from?.id ?? null,
                message: c.message,
                sentiment: 'neutral',
                moderationState: 'pending',
                commentedAt: c.created_time ? new Date(c.created_time) : null,
                fetchedAt: now,
                rawJson: JSON.stringify(c),
              },
            })
            fetched++
          }
        } catch {
          // continue to next post
        }
      }

      results.push({ pageId: pid, pageName, fetched, errors: [] })
    } catch (e) {
      results.push({ pageId: pid, pageName: pid, fetched: 0, errors: [String(e)] })
    }
  }

  return NextResponse.json({ success: true, results, fetchedAt: now.toISOString() })
}