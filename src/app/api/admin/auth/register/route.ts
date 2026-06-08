import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (process.env.ALLOW_REGISTRATION !== 'true') {
    return NextResponse.json({ error: 'Registrasi tidak dibuka' }, { status: 403 })
  }

  let body: { name?: string; email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { name, email, password } = body

  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: 'Semua field wajib diisi' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password minimal 8 karakter' }, { status: 400 })
  }

  const exists = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase().trim() } })
  if (exists) {
    return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.adminUser.create({
  data: {
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    role: 'user',
    status: 'pending',
  },
  })

  return NextResponse.json({ ok: true, message: 'Akun berhasil dibuat. Tunggu approval admin sebelum bisa login.' })
}
