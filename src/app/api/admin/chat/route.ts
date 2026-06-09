import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { decode } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

// ── Meta Graph API helpers ─────────────────────────────────────────
async function metaGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path}`)
  url.searchParams.set('access_token', token)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return fetch(url, { cache: 'no-store' })
}

// ── GET /api/admin/chat ────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const metaAccountId = searchParams.get('metaAccountId')
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '30')

  const where: Record<string, unknown> = {}
  if (metaAccountId) where.metaAccountId = metaAccountId

  const [threads, total] = await Promise.all([
    prisma.metaChatThread.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: { select: { messages: true } },
        metaPage: { select: { pageName: true, pageId: true } },
        metaAccount: { select: { id: true, name: true } },
      },
    }),
    prisma.metaChatThread.count({ where }),
  ])

  return NextResponse.json({ threads, total, page, pages: Math.ceil(total / limit) })
}

// ── POST /api/admin/chat ──────────────────────────────────────────
// Fetch chat threads from Meta Graph API and upsert into DB
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: { metaAccountId?: string; pageId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  let { metaAccountId, pageId } = body

  if (!metaAccountId) {
    const first = await prisma.metaAccount.findFirst({
      where: auth.role === 'admin' ? {} : { userId: auth.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    metaAccountId = first?.id
  }

  if (!metaAccountId) {
    return NextResponse.json({ error: 'No Meta account found' }, { status: 400 })
  }

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
    return NextResponse.json({ error: 'No token available' }, { status: 400 })
  }

  // Determine which pages to sync
  let pageIds: Array<{ pageId: string; metaPageId: string }> = []
  if (pageId) {
    const mp = await prisma.metaPage.findFirst({ where: { metaAccountId, pageId } })
    if (mp) pageIds = [{ pageId, metaPageId: mp.id }]
  } else {
    const pages = await prisma.metaPage.findMany({
      where: { metaAccountId, isActive: true },
      select: { pageId: true, id: true },
    })
    pageIds = pages.map(p => ({ pageId: p.pageId, metaPageId: p.id }))
  }

  if (pageIds.length === 0) {
    return NextResponse.json({ error: 'No pages found to sync' }, { status: 400 })
  }

  const now = new Date()
  const results: { pageId: string; pageName: string; threadsFetched: number; messagesFetched: number; errors: string[] }[] = []

  for (const { pageId: pid, metaPageId } of pageIds) {
    try {
      // Get page info
      const pageInfoRes = await metaGet(pid, token, { fields: 'name' })
      const pageName = pageInfoRes.ok ? (await pageInfoRes.json()).name ?? pid : pid

      // Fetch conversations
      const convRes = await metaGet(`${pid}/conversations`, token, {
        fields: 'id,updated_time,snippet,unread_count,participants',
        limit: '50',
      })
      if (!convRes.ok) {
        results.push({ pageId: pid, pageName, threadsFetched: 0, messagesFetched: 0, errors: ['Failed to fetch conversations'] })
        continue
      }

      const convData = await convRes.json()
      const conversations: Array<{
        id: string
        updated_time?: string
        snippet?: string
        unread_count?: number
        participants?: { data: Array<{ name?: string; id?: string }> }
      }> = convData?.data ?? []

      let threadsUpserted = 0
      let messagesUpserted = 0

      for (const conv of conversations) {
        // Get participants to extract customer name/ID
        const customer = conv.participants?.data?.find(p => p.id !== pid)
        const customerMetaId = customer?.id ?? null
        const customerName = customer?.name ?? null

        // Upsert thread
        const thread = await prisma.metaChatThread.upsert({
          where: {
            metaAccountId_threadMetaId: {
              metaAccountId,
              threadMetaId: conv.id,
            },
          },
          update: {
            metaPageId,
            customerMetaId,
            customerName,
            unreadCount: conv.unread_count ?? 0,
            lastMessageAt: conv.updated_time ? new Date(conv.updated_time) : now,
            lastSyncedAt: now,
          },
          create: {
            metaAccountId,
            metaPageId,
            threadMetaId: conv.id,
            customerMetaId,
            customerName,
            unreadCount: conv.unread_count ?? 0,
            lastMessageAt: conv.updated_time ? new Date(conv.updated_time) : now,
            lastSyncedAt: now,
            platform: 'facebook',
          },
        })
        threadsUpserted++

        // Fetch messages for this conversation
        const msgRes = await metaGet(`${conv.id}/messages`, token, {
          fields: 'id,message,created_time,from,to,attachments',
          limit: '50',
        })
        if (msgRes.ok) {
          const msgData = await msgRes.json()
          const messages: Array<{
            id: string
            message?: string
            created_time?: string
            from?: { id: string; name?: string }
            to?: { data: Array<{ id: string; name?: string }> }
            attachments?: { data: Array<unknown> }
          }> = msgData?.data ?? []

          for (const msg of messages) {
            const senderMetaId = msg.from?.id ?? null
            const direction = senderMetaId === pid ? 'outbound' : 'inbound'

            await prisma.metaChatMessage.upsert({
              where: {
                threadId_messageMetaId: {
                  threadId: thread.id,
                  messageMetaId: msg.id,
                },
              },
              update: {
                senderMetaId,
                senderName: msg.from?.name ?? null,
                body: msg.message ?? null,
                direction,
                attachmentJson: msg.attachments ? JSON.stringify(msg.attachments) : null,
                sentAt: msg.created_time ? new Date(msg.created_time) : null,
              },
              create: {
                threadId: thread.id,
                messageMetaId: msg.id,
                senderMetaId,
                senderName: msg.from?.name ?? null,
                body: msg.message ?? null,
                direction,
                attachmentJson: msg.attachments ? JSON.stringify(msg.attachments) : null,
                sentAt: msg.created_time ? new Date(msg.created_time) : null,
              },
            })
            messagesUpserted++
          }
        }
      }

      results.push({ pageId: pid, pageName, threadsFetched: threadsUpserted, messagesFetched: messagesUpserted, errors: [] })
    } catch (e) {
      results.push({ pageId: pid, pageName: pid, threadsFetched: 0, messagesFetched: 0, errors: [String(e)] })
    }
  }

  return NextResponse.json({ success: true, results, syncedAt: now.toISOString() })
}
