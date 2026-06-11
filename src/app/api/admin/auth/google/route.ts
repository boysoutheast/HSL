import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// GET /api/admin/auth/google — redirect ke Google OAuth consent
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'Google login belum dikonfigurasi (GOOGLE_CLIENT_ID missing)' }, { status: 503 })
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? new URL(req.url).origin
  const redirectUri = `${base.replace(/\/$/, '')}/api/admin/auth/google/callback`

  // CSRF state cookie
  const state = crypto.randomBytes(16).toString('hex')

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('state', state)
  url.searchParams.set('prompt', 'select_account')

  const res = NextResponse.redirect(url.toString())
  res.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return res
}
