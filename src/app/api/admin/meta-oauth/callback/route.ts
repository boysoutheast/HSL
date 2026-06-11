import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { encode } from '@/lib/crypto'
import { graphFetch, META_API_VERSION } from '@/lib/meta-graph'

export const dynamic = 'force-dynamic'

interface FbTokenResponse {
  access_token?: string
  expires_in?: number
}

// GET /api/admin/meta-oauth/callback — exchange code → long-lived token → sync assets
export async function GET(req: NextRequest) {
  const base = (process.env.NEXT_PUBLIC_BASE_URL ?? new URL(req.url).origin).replace(/\/$/, '')
  const fail = (reason: string) =>
    NextResponse.redirect(`${base}/meta-connections?error=${encodeURIComponent(reason)}`)

  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) {
    return NextResponse.redirect(`${base}/login?redirect=/meta-connections`)
  }

  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) return fail('META_APP_ID / META_APP_SECRET belum diset')

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const cookieState = req.cookies.get('meta_oauth_state')?.value

  if (!code) return fail(searchParams.get('error_description') ?? 'Login Facebook dibatalkan')
  if (!state || !cookieState || state !== cookieState) return fail('State mismatch — coba lagi')

  const redirectUri = `${base}/api/admin/meta-oauth/callback`

  try {
    // 1. Code → short-lived token
    const shortUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`)
    shortUrl.searchParams.set('client_id', appId)
    shortUrl.searchParams.set('client_secret', appSecret)
    shortUrl.searchParams.set('redirect_uri', redirectUri)
    shortUrl.searchParams.set('code', code)
    const shortRes = await fetch(shortUrl.toString())
    const shortData = (await shortRes.json()) as FbTokenResponse
    if (!shortRes.ok || !shortData.access_token) return fail('Token exchange gagal')

    // 2. Short → long-lived token (60 hari)
    const longUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`)
    longUrl.searchParams.set('grant_type', 'fb_exchange_token')
    longUrl.searchParams.set('client_id', appId)
    longUrl.searchParams.set('client_secret', appSecret)
    longUrl.searchParams.set('fb_exchange_token', shortData.access_token)
    const longRes = await fetch(longUrl.toString())
    const longData = (await longRes.json()) as FbTokenResponse
    const token = longData.access_token ?? shortData.access_token
    const expiresIn = longData.expires_in ?? 60 * 24 * 60 * 60

    // 3. Profile + scopes
    const me = await graphFetch<{ id: string; name: string }>('me', token, {
      params: { fields: 'id,name' },
    })
    const debugData = await graphFetch<{ data?: { scopes?: string[] } }>('debug_token', `${appId}|${appSecret}`, {
      params: { input_token: token },
    })

    // 4. Upsert MetaAccount (1 per meta user per HSL user)
    const existing = await prisma.metaAccount.findFirst({
      where: { userId: auth.id, metaUserId: me.id },
    })

    const accountData = {
      name: `${me.name} (Facebook Login)`,
      appId,
      appSecretEncrypted: encode(appSecret),
      longLivedTokenEncrypted: encode(token),
      tokenExpiry: new Date(Date.now() + expiresIn * 1000),
      metaUserId: me.id,
      metaUserName: me.name,
      scopesJson: JSON.stringify(debugData.data?.scopes ?? []),
      status: 'connected',
      lastTokenCheckAt: new Date(),
    }

    const account = existing
      ? await prisma.metaAccount.update({ where: { id: existing.id }, data: accountData })
      : await prisma.metaAccount.create({ data: { userId: auth.id, ...accountData } })

    // 5. Sync businesses + ad accounts + pages (best-effort)
    try {
      const businesses = await graphFetch<{ data?: Array<{ id: string; name: string; verification_status?: string }> }>(
        'me/businesses', token, { params: { fields: 'id,name,verification_status', limit: '50' } }
      )
      for (const biz of businesses.data ?? []) {
        await prisma.metaBusiness.upsert({
          where: { metaAccountId_businessId: { metaAccountId: account.id, businessId: biz.id } },
          create: {
            metaAccountId: account.id,
            businessId: biz.id,
            businessName: biz.name,
            verificationStatus: biz.verification_status ?? null,
            lastSyncedAt: new Date(),
          },
          update: { businessName: biz.name, verificationStatus: biz.verification_status ?? null, lastSyncedAt: new Date() },
        })
      }

      const adAccounts = await graphFetch<{ data?: Array<{ id: string; account_id: string; name: string; account_status: number; currency: string; timezone_name: string; business?: { id: string } }> }>(
        'me/adaccounts', token,
        { params: { fields: 'id,account_id,name,account_status,currency,timezone_name,business', limit: '100' } }
      )
      for (const aa of adAccounts.data ?? []) {
        await prisma.metaAdAccount.upsert({
          where: { metaAccountId_adAccountId: { metaAccountId: account.id, adAccountId: aa.id } },
          create: {
            metaAccountId: account.id,
            adAccountId: aa.id,
            adAccountName: aa.name,
            accountStatus: aa.account_status ?? 1,
            currency: aa.currency ?? null,
            timezoneName: aa.timezone_name ?? null,
            businessId: aa.business?.id ?? null,
            lastSyncedAt: new Date(),
          },
          update: {
            adAccountName: aa.name,
            accountStatus: aa.account_status ?? 1,
            currency: aa.currency ?? null,
            timezoneName: aa.timezone_name ?? null,
            lastSyncedAt: new Date(),
          },
        })
      }

      const pages = await graphFetch<{ data?: Array<{ id: string; name: string; access_token?: string; instagram_business_account?: { id: string; username?: string; name?: string } }> }>(
        'me/accounts', token,
        { params: { fields: 'id,name,access_token,instagram_business_account{id,username,name}', limit: '100' } }
      )
      for (const page of pages.data ?? []) {
        await prisma.metaPage.upsert({
          where: { metaAccountId_pageId: { metaAccountId: account.id, pageId: page.id } },
          create: {
            metaAccountId: account.id,
            pageId: page.id,
            pageName: page.name,
            pageAccessTokenEncrypted: page.access_token ? encode(page.access_token) : null,
            igBusinessAccountId: page.instagram_business_account?.id ?? null,
            igUsername: page.instagram_business_account?.username ?? null,
            igName: page.instagram_business_account?.name ?? null,
            lastSyncedAt: new Date(),
          },
          update: {
            pageName: page.name,
            pageAccessTokenEncrypted: page.access_token ? encode(page.access_token) : null,
            igBusinessAccountId: page.instagram_business_account?.id ?? null,
            igUsername: page.instagram_business_account?.username ?? null,
            igName: page.instagram_business_account?.name ?? null,
            lastSyncedAt: new Date(),
          },
        })
      }

      await prisma.metaAccount.update({
        where: { id: account.id },
        data: { lastSyncAt: new Date() },
      })
    } catch (syncErr) {
      console.error('[meta-oauth] asset sync partial failure:', syncErr)
      // Connection tetap sukses — sync bisa diulang dari UI
    }

    const res = NextResponse.redirect(`${base}/meta-connections?connected=1`)
    res.cookies.set('meta_oauth_state', '', { maxAge: 0, path: '/' })
    return res
  } catch (err) {
    console.error('[meta-oauth] callback error:', err)
    return fail(err instanceof Error ? err.message : 'Facebook connect gagal')
  }
}
