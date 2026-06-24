import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail, generateToken, hashToken, tokenExpiry } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })
  }

  // Always return ok=true — anti user-enumeration
  const user = await prisma.adminUser.findUnique({ where: { email } })

  if (user && user.status === 'active') {
    const token = generateToken()
    const tokenHash = hashToken(token)

    // Invalidate old tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    })

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: tokenExpiry(1),
      },
    })

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
    const resetLink = `${baseUrl}/reset-password?token=${token}`

    await sendEmail({
      to: email,
      subject: 'Reset Password — AI Buddy',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2>Reset Password</h2>
          <p>Klik tombol di bawah untuk mereset password akun AI Buddy Anda.</p>
          <a href="${resetLink}"
             style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
            Reset Password
          </a>
          <p style="margin-top:24px;color:#888;font-size:13px;">
            Link ini berlaku 1 jam. Abaikan email ini jika Anda tidak meminta reset password.
          </p>
        </div>
      `,
    })
  }

  return NextResponse.json({ ok: true, message: 'Jika email terdaftar, link reset password akan dikirim.' })
}
