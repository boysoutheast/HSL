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

  // Always return ok — anti user-enumeration
  const user = await prisma.adminUser.findUnique({ where: { email } })

  if (user && !user.emailVerified) {
    // Invalidate old verification tokens
    await prisma.emailVerificationToken.deleteMany({
      where: { userId: user.id },
    })

    const token = generateToken()
    const tokenHash = hashToken(token)

    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: tokenExpiry(24), // 24 hours for verification
      },
    })

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
    const verifyLink = `${baseUrl}/api/admin/auth/verify-email?token=${token}`

    await sendEmail({
      to: email,
      subject: 'Verifikasi Email — AI Buddy',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2>Verifikasi Email</h2>
          <p>Klik tombol di bawah untuk memverifikasi email akun AI Buddy Anda.</p>
          <a href="${verifyLink}"
             style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
            Verifikasi Email
          </a>
          <p style="margin-top:24px;color:#888;font-size:13px;">
            Link ini berlaku 24 jam. Abaikan email ini jika Anda tidak mendaftar.
          </p>
        </div>
      `,
    })
  }

  return NextResponse.json({ ok: true, message: 'Jika email terdaftar dan belum diverifikasi, link verifikasi akan dikirim.' })
}
