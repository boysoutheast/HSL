import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, deleteSession, clearSessionCookie } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (token) await deleteSession(token)

  const res = NextResponse.json({ success: true })
  clearSessionCookie(res)
  return res
}
