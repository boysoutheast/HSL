import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { checkRateLimit, getRateLimitKey } from '@/lib/rate-limit'
import { sendEmail, generateToken, hashToken, tokenExpiry } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Rate limit: 3 registrations per hour per IP
  const rlKey = getRateLimitKey(req, 'register')
  const rl = checkRateLimit(rlKey, 3, 60 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Too many registrations. Coba lagi nanti.', resetAt: rl.resetAt },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    )
  }

  // Self-serve SaaS: registrasi terbuka default. Set ALLOW_REGISTRATION=false untuk nutup.
  if (process.env.ALLOW_REGISTRATION === 'false') {
    return NextResponse.json({ error: 'Registrasi tidak dibuka' }, { status: 403 })
  }

  let body: { name?: string; email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const name = (body.name as string)?.trim().slice(0, 200) ?? ''
  const email = (body.email as string)?.trim().toLowerCase().slice(0, 255) ?? ''
  const password = (body.password as string) ?? ''

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Semua field wajib diisi' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password minimal 8 karakter' }, { status: 400 })
  }

  const exists = await prisma.adminUser.findUnique({ where: { email } })
  if (exists) {
    return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.adminUser.create({
    data: {
      name,
      email,
      passwordHash,
      role: 'user',
      status: 'pending',
    },
  })

  // Send verification email (graceful — jangan crash kalau Resend belum diset)
  const verifToken = generateToken()
  const verifTokenHash = hashToken(verifToken)

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: verifTokenHash,
      expiresAt: tokenExpiry(24),
    },
  })

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const verifyLink = `${baseUrl}/api/admin/auth/verify-email?token=${verifToken}`

  await sendEmail({
    to: email,
    subject: 'Verifikasi Email — AI Buddy',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2>Selamat datang di AI Buddy!</h2>
        <p>Klik tombol di bawah untuk memverifikasi email Anda.</p>
        <a href="${verifyLink}"
           style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
          Verifikasi Email
        </a>
        <p style="margin-top:24px;color:#888;font-size:13px;">
          Link ini berlaku 24 jam. Setelah verifikasi, tunggu approval admin untuk bisa login.
        </p>
      </div>
    `,
  })

  return NextResponse.json({ ok: true, message: 'Akun berhasil dibuat. Cek email untuk verifikasi, lalu tunggu approval admin.' })
}
