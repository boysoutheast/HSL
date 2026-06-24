import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: { currentPassword?: string; newPassword?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { currentPassword, newPassword } = body

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Current password dan new password wajib diisi' }, { status: 400 })
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Password minimal 8 karakter' }, { status: 400 })
  }

  // Get user with password hash
  const user = await prisma.adminUser.findUnique({
    where: { id: auth.id },
    select: { id: true, passwordHash: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Verify current password with timing-safe bcrypt compare
  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Password saat ini salah' }, { status: 403 })
  }

  // Hash new password and update
  const passwordHash = await bcrypt.hash(newPassword, 12)

  await prisma.adminUser.update({
    where: { id: auth.id },
    data: { passwordHash },
  })

  console.log(`[audit] User ${auth.id} changed password`)

  return NextResponse.json({ ok: true, message: 'Password berhasil diubah.' })
}
