import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { createSession, setSessionCookie } from '@/lib/session'
import { isLocked, recordFailure, recordSuccess, getRateLimitKey } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const rlKey = getRateLimitKey(req, 'login')

  // Cek dulu apakah sedang dalam masa lockout
  const lockCheck = isLocked(rlKey)
  if (!lockCheck.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${lockCheck.waitSeconds} detik.`,
        resetAt: lockCheck.resetAt,
        waitSeconds: lockCheck.waitSeconds,
      },
      { status: 429, headers: { 'Retry-After': String(lockCheck.waitSeconds) } },
    )
  }

  let body: { email: string; password: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.email || !body.password) {
    return NextResponse.json({ error: 'email and password are required' }, { status: 400 })
  }

  const user = await prisma.adminUser.findUnique({ where: { email: body.email } })

  const valid = user && user.status === 'active'
    ? await bcrypt.compare(body.password, user.passwordHash)
    : false

  if (!valid) {
    // Hitung sebagai percobaan gagal → mungkin trigger lockout
    const failResult = recordFailure(rlKey)
    if (!failResult.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${failResult.waitSeconds} detik.`,
          resetAt: failResult.resetAt,
          waitSeconds: failResult.waitSeconds,
        },
        { status: 429, headers: { 'Retry-After': String(failResult.waitSeconds) } },
      )
    }
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  // Login sukses → reset counter + record login time
  recordSuccess(rlKey)

  await prisma.adminUser.update({
    where: { id: user!.id },
    data: { lastLoginAt: new Date() },
  })

  const token = await createSession(user!.id)
  const res = NextResponse.json({
    success: true,
    user: { id: user!.id, email: user!.email, name: user!.name, role: user!.role },
  })
  setSessionCookie(res, token)
  return res
}
