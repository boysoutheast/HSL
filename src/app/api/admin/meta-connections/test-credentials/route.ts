import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/meta-connections/test-credentials
 *
 * Validates Meta credentials WITHOUT storing them.
 * Currently returns a MOCK response — real Meta API call structure is in place
 * and ready to be enabled once appId/appSecret/userAccessToken are available.
 *
 * Real Meta endpoint:
 *   GET https://graph.facebook.com/v21.0/debug_token
 *     ?input_token={userAccessToken}&access_token={appId}|{appSecret}
 *
 * Response shape:
 *   data { is_valid, scopes, user_id, user_name, expires_at }
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    appId?: string
    appSecret?: string
    userAccessToken?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { appId, appSecret, userAccessToken } = body

  if (!appId || !appSecret || !userAccessToken) {
    return NextResponse.json(
      { valid: false, error: 'appId, appSecret, and userAccessToken are all required' },
      { status: 400 },
    )
  }

  // ── Real Meta API call (commented out, structure ready) ──────────────────
  // try {
  //   const debugUrl =
  //     `https://graph.facebook.com/v21.0/debug_token` +
  //     `?input_token=${encodeURIComponent(userAccessToken)}` +
  //     `&access_token=${encodeURIComponent(appId)}|${encodeURIComponent(appSecret)}`
  //
  //   const res = await fetch(debugUrl, { method: 'GET' })
  //   const data = await res.json()
  //
  //   if (!res.ok || !data?.data?.is_valid) {
  //     return NextResponse.json({
  //       valid: false,
  //       error: data?.error?.message ?? 'Token validation failed',
  //     })
  //   }
  //
  //   const tokenData = data.data
  //   return NextResponse.json({
  //     valid: true,
  //     scopes: tokenData.scopes ?? [],
  //     metaUserId: tokenData.user_id ?? null,
  //     metaUserName: tokenData.user_name ?? null,
  //     tokenExpiresAt: tokenData.expires_at
  //       ? new Date(tokenData.expires_at * 1000).toISOString()
  //       : null,
  //     scopesJson: JSON.stringify(tokenData.scopes ?? []),
  //   })
  // } catch (err) {
  //   return NextResponse.json({
  //     valid: false,
  //     error: 'Failed to reach Meta API',
  //   })
  // }
  // ─────────────────────────────────────────────────────────────────────────

  // MOCK response — replace with real call above when ready
  return NextResponse.json({
    valid: true,
    scopes: ['ads_management', 'ads_read', 'business_management'],
    metaUserId: 'mock_user_id',
    metaUserName: 'mock_user',
    tokenExpiresAt: null,
    scopesJson: JSON.stringify(['ads_management', 'ads_read', 'business_management']),
  })
}
