import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { createSession, setSessionCookie } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
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
