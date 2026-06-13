/**
 * Telegram helper — kirim pesan ke user via Bot API.
 * Token via env TELEGRAM_BOT_TOKEN.
 * .catch(() => {}) — jangan crash caller.
 */

const TOKEN = process.env.TELEGRAM_BOT_TOKEN

export async function sendTelegram(chatId: string | number, text: string): Promise<boolean> {
  if (!TOKEN) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN not set, skipping send')
    return false
  }

  if (!chatId) {
    console.warn('[telegram] chatId empty, skipping send')
    return false
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(chatId),
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`[telegram] HTTP ${res.status}: ${body.slice(0, 200)}`)
      return false
    }

    return true
  } catch (err) {
    console.error('[telegram] send failed:', (err as Error).message)
    return false
  }
}
