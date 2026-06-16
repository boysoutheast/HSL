import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runSaasResponder } from '@/lib/saas-responder'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/telegram
 * Receive user reply from Telegram Bot.
 * Bypass admin middleware (whitelisted in middleware.ts).
 */
export async function POST(req: NextRequest) {
  // Telegram sends X-Telegram-Bot-Api-Secret-Token when set during setWebhook
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (expected) {
    const provided = req.headers.get('x-telegram-bot-api-secret-token')
    if (provided !== expected) {
      return NextResponse.json({ ok: true }, { status: 200 }) // diamkan, jangan kasih sinyal
    }
  }

  let body: {
    message?: {
      chat?: { id: number }
      text?: string
      from?: { id: number; first_name?: string }
    }
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const chatId = body.message?.chat?.id
  const text = body.message?.text?.trim()
  const fromName = body.message?.from?.first_name ?? 'User'

  if (!chatId || !text) {
    return NextResponse.json({ ok: true, skipped: 'no text or chat_id' })
  }

  // Ignore bot commands like /start
  if (text.startsWith('/')) {
    return NextResponse.json({ ok: true, skipped: 'command ignored' })
  }

  const chatIdStr = String(chatId)

  // Map chat_id to latest thread with status=waiting_user
  const thread = await prisma.conversationThread.findFirst({
    where: {
      telegramChatId: chatIdStr,
      status: 'waiting_user',
    },
    orderBy: { updatedAt: 'desc' },
  })

  if (!thread) {
    // No thread waiting for this user — ignore
    return NextResponse.json({ ok: true, skipped: 'no waiting thread' })
  }

  // Insert user message
  await prisma.threadMessage.create({
    data: {
      threadId: thread.id,
      role: 'user',
      kind: 'text',
      content: `${fromName}: ${text}`,
    },
  })

  // Set thread back to open
  await prisma.conversationThread.update({
    where: { id: thread.id },
    data: { status: 'open' },
  })

  // Fire-and-forget SaaS responder (non-blocking)
  runSaasResponder(thread.id).catch(err => {
    console.error('[webhooks/telegram] runSaasResponder failed:', (err as Error).message)
  })

  return NextResponse.json({ ok: true, threadId: thread.id })
}
