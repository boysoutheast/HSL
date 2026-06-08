import { NextRequest, NextResponse } from 'next/server'
import { prisma } from './prisma'
import crypto from 'crypto'

export const SESSION_COOKIE = 'hermes_session'
export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000 // 8 hours

export type SessionUser = {
  id: string
  email: string
  name: string | null
  role: 'admin' | 'user'
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

  await prisma.session.create({
    data: { token, userId, expiresAt },
  })

  return token
}

export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { token } }).catch(() => {})
    return null
  }

  if (session.user.status !== 'active') return null

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role as 'admin' | 'user',
  }
}

export async function deleteSession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } }).catch(() => {})
}

export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION_MS / 1000,
    path: '/',
  })
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, '', { maxAge: 0, path: '/' })
}
