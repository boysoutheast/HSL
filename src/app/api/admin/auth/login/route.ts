import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { createSession, setSessionCookie } from '@/lib/session'
import { checkRateLimit, getRateLimitKey } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Rate limit: 5 attempts per 15 minutes per IP
  const rlKey = getRateLimitKey(req, 'login')
  const rl = checkRateLimit(rlKey, 5, 15 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Too many attempts. Coba lagi nanti.', resetAt: rl.resetAt },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
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

  if (!user || user.status !== 'active') {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const valid = await bcrypt.compare(body.password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = await createSession(user.id)

  const res = NextResponse.json({
    success: true,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  })

  setSessionCookie(res, token)
  return res
}
