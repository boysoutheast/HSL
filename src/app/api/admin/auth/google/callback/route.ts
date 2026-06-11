import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSession, setSessionCookie } from '@/lib/session'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// GET /api/admin/auth/google/callback — exchange code → session
export async function GET(req: NextRequest) {
  const base = (process.env.NEXT_PUBLIC_BASE_URL ?? new URL(req.url).origin).replace(/\/$/, '')
  const fail = (reason: string) =>
    NextResponse.redirect(`${base}/login?error=${encodeURIComponent(reason)}`)

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return fail('Google login belum dikonfigurasi')

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const cookieState = req.cookies.get('google_oauth_state')?.value

  if (!code) return fail('Google login dibatalkan')
  if (!state || !cookieState || state !== cookieState) return fail('State mismatch — coba lagi')

  // Exchange code → tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${base}/api/admin/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  })
  const tokenData = await tokenRes.json().catch(() => null)
  if (!tokenRes.ok || !tokenData?.access_token) return fail('Token exchange gagal')

  // Ambil profile user
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const profile = await profileRes.json().catch(() => null)
  if (!profileRes.ok || !profile?.email || !profile?.verified_email) {
    return fail('Email Google tidak terverifikasi')
  }

  const email = String(profile.email).toLowerCase()

  let user = await prisma.adminUser.findUnique({ where: { email } })

  if (!user) {
    // User baru: ikuti flow register → pending approval admin
    user = await prisma.adminUser.create({
      data: {
        email,
        name: profile.name ?? email.split('@')[0],
        // Google account tidak punya password — random hash supaya field terisi
        passwordHash: crypto.randomBytes(32).toString('hex'),
        role: 'user',
        status: 'pending',
      },
    })
  }

  if (user.status === 'pending') {
    return NextResponse.redirect(`${base}/login?pending=1`)
  }
  if (user.status !== 'active') {
    return fail('Akun tidak aktif. Hubungi admin.')
  }

  const token = await createSession(user.id)
  const res = NextResponse.redirect(`${base}/`)
  setSessionCookie(res, token)
  res.cookies.set('google_oauth_state', '', { maxAge: 0, path: '/' })
  return res
}
