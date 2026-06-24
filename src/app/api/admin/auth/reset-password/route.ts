import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashToken } from '@/lib/email'
import bcrypt from 'bcryptjs'
import { createSession, setSessionCookie } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let body: { token?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { token, password } = body

  if (!token || !password) {
    return NextResponse.json({ error: 'Token dan password wajib diisi' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password minimal 8 karakter' }, { status: 400 })
  }

  const tokenHash = hashToken(token)

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  })

  if (!resetToken) {
    return NextResponse.json({ error: 'Token tidak valid' }, { status: 400 })
  }

  if (resetToken.usedAt) {
    return NextResponse.json({ error: 'Token sudah digunakan' }, { status: 400 })
  }

  if (resetToken.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Token sudah kedaluwarsa' }, { status: 400 })
  }

  if (resetToken.user.status !== 'active') {
    return NextResponse.json({ error: 'Akun tidak aktif' }, { status: 403 })
  }

  // Update password + mark token used
  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.$transaction([
    prisma.adminUser.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    // Invalidate all existing sessions for that user (force re-login)
    prisma.session.deleteMany({
      where: { userId: resetToken.userId },
    }),
  ])

  // Create new session after successful reset
  const newToken = await createSession(resetToken.userId)
  const res = NextResponse.json({
    ok: true,
    message: 'Password berhasil direset. Silakan login dengan password baru.',
  })
  setSessionCookie(res, newToken)

  return res
}
