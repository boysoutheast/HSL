import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { safeMetaError } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: { appId?: string; appSecret?: string; userAccessToken?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { appId, appSecret, userAccessToken } = body
  if (!appId || !appSecret || !userAccessToken) {
    return NextResponse.json({ valid: false, error: 'appId, appSecret, and userAccessToken are all required' }, { status: 400 })
  }

  const url = new URL('https://graph.facebook.com/v21.0/debug_token')
  url.searchParams.set('input_token', userAccessToken)
  url.searchParams.set('access_token', `${appId}|${appSecret}`)

  try {
    const res = await fetch(url, { method: 'GET', cache: 'no-store' })
    const data = await res.json()
    if (!res.ok || !data?.data?.is_valid) {
      return NextResponse.json({ valid: false, error: safeMetaError(data) })
    }

    const tokenData = data.data
    return NextResponse.json({
      valid: true,
      appId: tokenData.app_id ?? appId,
      type: tokenData.type ?? null,
      application: tokenData.application ?? null,
      scopes: tokenData.scopes ?? [],
      granularScopes: tokenData.granular_scopes ?? [],
      metaUserId: tokenData.user_id ?? null,
      expiresAt: tokenData.expires_at ?? 0,
      dataAccessExpiresAt: tokenData.data_access_expires_at ?? 0,
      tokenExpiresAt: tokenData.expires_at ? new Date(tokenData.expires_at * 1000).toISOString() : null,
      scopesJson: JSON.stringify(tokenData.scopes ?? []),
    })
  } catch {
    return NextResponse.json({ valid: false, error: 'Failed to reach Meta API' }, { status: 502 })
  }
}
