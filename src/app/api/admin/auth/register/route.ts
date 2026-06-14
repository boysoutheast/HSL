import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { checkRateLimit, getRateLimitKey } from '@/lib/rate-limit'

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

  await prisma.adminUser.create({
  data: {
    name,
    email,
    passwordHash,
    role: 'user',
    status: 'pending',
  },
  })

  return NextResponse.json({ ok: true, message: 'Akun berhasil dibuat. Tunggu approval admin sebelum bisa login.' })
}
