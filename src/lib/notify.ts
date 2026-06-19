/**
 * notify.ts — Notifikasi in-app + Telegram opsional.
 *
 * In-app selalu dikirim (default).
 * Telegram dikirim kalau user punya telegramChatId (best-effort, no-crash).
 * De-dupe: same type + refId dalam window 1 jam → skip (cegah spam warning berulang).
 */

import { prisma } from '@/lib/prisma'

export interface NotifyInput {
  type: 'rule_fired' | 'write_failed' | 'pool_exhausted' | 'token_expired' | 'topup_created' | 'budget_changed'
  severity?: 'info' | 'success' | 'warning' | 'error'
  title: string
  body?: string
  refType?: string
  refId?: string
}

const DEDUPE_WINDOW_MS = 60 * 60 * 1000 // 1 jam

/**
 * Kirim notifikasi ke user.
 * - Insert ke tabel notifications (in-app).
 * - Kalau user punya telegramChatId, kirim Telegram (best-effort, no-crash).
 * - De-dupe: type + refId sama dalam 1 jam terakhir → skip insert + Telegram.
 */
export async function notify(userId: string, input: NotifyInput): Promise<void> {
  // ── De-dupe check ──────────────────────────────────
  if (input.refId) {
    const recent = await prisma.notification.findFirst({
      where: {
        userId,
        type: input.type,
        refId: input.refId,
        createdAt: { gte: new Date(Date.now() - DEDUPE_WINDOW_MS) },
      },
      select: { id: true },
    })
    if (recent) {
      console.log(`[notify] dedupe: ${input.type} ${input.refId} for user ${userId} — within 1h window`)
      return
    }
  }

  // ── In-app insert ──────────────────────────────────
  const notification = await prisma.notification.create({
    data: {
      userId,
      type: input.type,
      severity: input.severity ?? 'info',
      title: input.title,
      body: input.body ?? null,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
    },
  })

  console.log(`[notify] created notification ${notification.id} for user ${userId}: ${input.type}`)

  // ── Telegram (opsional, best-effort) ───────────────
  await sendTelegramIfEnabled(userId, input)
}

/**
 * Kirim Telegram kalau user punya telegramChatId.
 * Best-effort: .catch(() => {}) — gak boleh crash scan/topup.
 */
async function sendTelegramIfEnabled(userId: string, input: NotifyInput): Promise<void> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) return // Telegram belum disetup

    const user = await prisma.adminUser.findUnique({
      where: { id: userId },
      select: { telegramChatId: true },
    })
    if (!user?.telegramChatId) return

    const emoji: Record<string, string> = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
    }
    const icon = emoji[input.severity ?? 'info'] ?? 'ℹ️'
    const text = `${icon} *${input.title}*\n${input.body ?? ''}`

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: user.telegramChatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    })
  } catch (err) {
    // Best-effort — no-crash
    console.warn(`[notify] Telegram send failed for user ${userId}:`, String(err))
  }
}
