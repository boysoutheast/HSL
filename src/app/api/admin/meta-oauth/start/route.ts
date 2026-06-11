import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { META_API_VERSION } from '@/lib/meta-graph'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// GET /api/admin/meta-oauth/start — redirect ke Facebook Login for Business
// Pakai META_LOGIN_CONFIG_ID (Business profile config) kalau ada; fallback ke scope list.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) {
    // Belum login → ke login page dulu
    const base = (process.env.NEXT_PUBLIC_BASE_URL ?? new URL(req.url).origin).replace(/\/$/, '')
    return NextResponse.redirect(`${base}/login?redirect=/meta-connections`)
  }

  const appId = process.env.META_APP_ID
  if (!appId) {
    return NextResponse.json(
      { error: 'Facebook login belum dikonfigurasi (META_APP_ID missing)' },
      { status: 503 }
    )
  }

  const base = (process.env.NEXT_PUBLIC_BASE_URL ?? new URL(req.url).origin).replace(/\/$/, '')
  const redirectUri = `${base}/api/admin/meta-oauth/callback`
  const state = crypto.randomBytes(16).toString('hex')
  const configId = process.env.META_LOGIN_CONFIG_ID

  const url = new URL(`https://www.facebook.com/${META_API_VERSION}/dialog/oauth`)
  url.searchParams.set('client_id', appId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set('response_type', 'code')
  if (configId) {
    // Facebook Login for Business — config "Business profile"
    url.searchParams.set('config_id', configId)
  } else {
    url.searchParams.set(
      'scope',
      'ads_management,ads_read,business_management,pages_show_list,pages_read_engagement,instagram_basic'
    )
  }

  const res = NextResponse.redirect(url.toString())
  res.cookies.set('meta_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return res
}
