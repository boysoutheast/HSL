import crypto from 'crypto'

type EmailPayload = {
  to: string
  subject: string
  html: string
}

/**
 * Send email via Resend. Graceful fallback jika RESEND_API_KEY tidak diset:
 * log warning + jangan crash.
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn(
      `[email] RESEND_API_KEY not set — skipping email to ${payload.to} (subject: ${payload.subject})`,
    )
    return
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? 'AI Buddy <noreply@ai-buddy.app>',
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`[email] Resend API error ${res.status}: ${body}`)
      return
    }

    console.log(`[email] Sent to ${payload.subject}`)
  } catch (err) {
    console.error(`[email] Failed to send email:`, err)
  }
}

// ── Token helpers ─────────────────────────────────────────────────────────

/** Generate a cryptographically random token (hex). */
export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/** Hash a token with SHA-256 so the raw value is never stored. */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/** Default token expiry: 1 hour from now. */
export function tokenExpiry(hours: number = 1): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000)
}
