import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { decode } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

// ── Meta Graph API helpers ─────────────────────────────────────────
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

// ── GET /api/admin/chat/[id] ───────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const thread = await prisma.metaChatThread.findUnique({
    where: { id: params.id },
    include: {
      messages: {
        orderBy: { sentAt: 'asc' },
        take: 100,
      },
      metaPage: { select: { pageName: true, pageId: true } },
      metaAccount: { select: { id: true, name: true } },
    },
  })

  if (!thread) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
  }

  return NextResponse.json({ thread })
}

// ── POST /api/admin/chat/[id] ──────────────────────────────────────
// Send a message to the thread
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const thread = await prisma.metaChatThread.findUnique({
    where: { id: params.id },
    include: {
      metaPage: true,
      metaAccount: true,
    },
  })

  if (!thread) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
  }

  let body: { message: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { message } = body
  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  // Get page token
  let token = ''
  if (thread.metaPage?.pageAccessTokenEncrypted) {
    token = decode(thread.metaPage.pageAccessTokenEncrypted)
  }
  if (!token && thread.metaAccount) {
    token = decode(
      thread.metaAccount.longLivedTokenEncrypted ??
      thread.metaAccount.shortLivedTokenEncrypted ??
      '',
    )
  }

  if (!token) {
    return NextResponse.json({ error: 'No token available to send message' }, { status: 400 })
  }

  // Send via Meta Graph API
  const sendRes = await metaPost(`${thread.threadMetaId}/messages`, token, { message })
  const sendData = await sendRes.json()

  if (!sendRes.ok) {
    return NextResponse.json(
      { error: 'Meta API error', detail: sendData },
      { status: 502 },
    )
  }

  // Save outbound message to DB
  const savedMsg = await prisma.metaChatMessage.create({
    data: {
      threadId: thread.id,
      messageMetaId: sendData.id ?? `local_${Date.now()}`,
      senderMetaId: null,
      senderName: null,
      body: message,
      direction: 'outbound',
      sentAt: new Date(),
    },
  })

  // Update thread lastMessageAt
  await prisma.metaChatThread.update({
    where: { id: thread.id },
    data: { lastMessageAt: new Date() },
  })

  return NextResponse.json({ success: true, message: savedMsg, metaResponse: sendData })
}
