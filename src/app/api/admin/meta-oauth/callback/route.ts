import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { encode } from '@/lib/crypto'
import { graphFetch, META_API_VERSION, MetaGraphError } from '@/lib/meta-graph'

export const dynamic = 'force-dynamic'

interface FbTokenResponse {
  access_token?: string
  expires_in?: number
}

interface PermissionEntry {
  permission?: string
  status?: string
}

interface MetaProfile {
  id: string
  name: string
}

interface MetaAdAccountEntry {
  id: string
  account_id?: string
  name?: string
  account_status?: number
  currency?: string
  timezone_name?: string
}

interface MetaPageEntry {
  id: string
  name?: string
  access_token?: string
  instagram_business_account?: {
    id?: string
    username?: string
    name?: string
  }
}

const REQUIRED_SCOPES = [
  'ads_management',
  'ads_read',
  'business_management',
  'pages_show_list',
  'pages_read_engagement',
  'instagram_basic',
] as const

function buildMetaConnectionsUrl(base: string, params: Record<string, string>) {
  const url = new URL('/meta-connections', base)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

export async function GET(req: NextRequest) {
  const base = (process.env.NEXT_PUBLIC_BASE_URL ?? new URL(req.url).origin).replace(/\/$/, '')
  const fail = (reason: string) =>
    NextResponse.redirect(buildMetaConnectionsUrl(base, { error: reason }))

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

  // Parse reconnect marker: "hex:reconnect:connectionId"
  const reconnectMatch = cookieState.match(/^[a-f0-9]+:reconnect:(.+)$/)
  const reconnectConnectionId = reconnectMatch ? reconnectMatch[1] : null

  const redirectUri = `${base}/api/admin/meta-oauth/callback`

  let accountIdForFailure: string | null = null

  try {
    const shortUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`)
    shortUrl.searchParams.set('client_id', appId)
    shortUrl.searchParams.set('client_secret', appSecret)
    shortUrl.searchParams.set('redirect_uri', redirectUri)
    shortUrl.searchParams.set('code', code)
    const shortRes = await fetch(shortUrl.toString(), { cache: 'no-store' })
    const shortData = (await shortRes.json()) as FbTokenResponse
    if (!shortRes.ok || !shortData.access_token) return fail('Token exchange gagal')

    const longUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`)
    longUrl.searchParams.set('grant_type', 'fb_exchange_token')
    longUrl.searchParams.set('client_id', appId)
    longUrl.searchParams.set('client_secret', appSecret)
    longUrl.searchParams.set('fb_exchange_token', shortData.access_token)
    const longRes = await fetch(longUrl.toString(), { cache: 'no-store' })
    const longData = (await longRes.json()) as FbTokenResponse
    if (!longRes.ok || !longData.access_token) return fail('Long-lived token exchange gagal')

    const shortToken = shortData.access_token
    const longToken = longData.access_token
    const expiresIn = longData.expires_in ?? 60 * 24 * 60 * 60
    const now = new Date()

    const [me, permissionData, adAccounts, pages] = await Promise.all([
      graphFetch<MetaProfile>('me', longToken, { params: { fields: 'id,name' } }),
      graphFetch<{ data?: PermissionEntry[] }>('me/permissions', longToken, { params: { limit: '200' } }),
      graphFetch<{ data?: MetaAdAccountEntry[] }>('me/adaccounts', longToken, {
        params: { fields: 'id,account_id,name,account_status,currency,timezone_name', limit: '200' },
      }),
      graphFetch<{ data?: MetaPageEntry[] }>('me/accounts', longToken, {
        params: { fields: 'id,name,access_token,instagram_business_account{id,username,name}', limit: '200' },
      }),
    ])

    const grantedScopes = (permissionData.data ?? [])
      .filter((entry) => entry.permission && entry.status === 'granted')
      .map((entry) => entry.permission as string)
    const missingRequiredScopes = REQUIRED_SCOPES.filter((scope) => !grantedScopes.includes(scope))

    const existing = reconnectConnectionId
      ? await prisma.metaAccount.findFirst({
          where: { id: reconnectConnectionId, userId: auth.id },
          select: { id: true },
        })
      : await prisma.metaAccount.findFirst({
          where: { userId: auth.id, metaUserId: me.id },
          select: { id: true },
        })

    const accountRecord = existing
      ? await prisma.metaAccount.update({
          where: { id: existing.id },
          data: {
            name: `${me.name} (Facebook Login)`,
            appId,
            appSecretEncrypted: encode(appSecret),
            shortLivedTokenEncrypted: encode(shortToken),
            longLivedTokenEncrypted: encode(longToken),
            tokenExpiry: new Date(Date.now() + expiresIn * 1000),
            metaUserId: me.id,
            metaUserName: me.name,
            scopesJson: JSON.stringify(grantedScopes),
            status: missingRequiredScopes.length ? 'needs_reconnect' : 'connected',
            lastMetaCallAt: now,
            lastTokenCheckAt: now,
            notes: missingRequiredScopes.length
              ? `Missing required scopes: ${missingRequiredScopes.join(', ')}`
              : null,
          },
          select: { id: true },
        })
      : await prisma.metaAccount.create({
          data: {
            userId: auth.id,
            name: `${me.name} (Facebook Login)`,
            appId,
            appSecretEncrypted: encode(appSecret),
            shortLivedTokenEncrypted: encode(shortToken),
            longLivedTokenEncrypted: encode(longToken),
            tokenExpiry: new Date(Date.now() + expiresIn * 1000),
            metaUserId: me.id,
            metaUserName: me.name,
            scopesJson: JSON.stringify(grantedScopes),
            status: missingRequiredScopes.length ? 'needs_reconnect' : 'connected',
            lastMetaCallAt: now,
            lastTokenCheckAt: now,
            notes: missingRequiredScopes.length
              ? `Missing required scopes: ${missingRequiredScopes.join(', ')}`
              : null,
          },
          select: { id: true },
        })

    accountIdForFailure = accountRecord.id

    if (missingRequiredScopes.length) {
      return NextResponse.redirect(
        buildMetaConnectionsUrl(base, {
          error: `Izin Meta belum lengkap. Missing scopes: ${missingRequiredScopes.join(', ')}`,
        })
      )
    }

    await prisma.$transaction(async (tx) => {
      for (const aa of adAccounts.data ?? []) {
        const normalizedAdAccountId = aa.account_id ? `act_${aa.account_id}` : aa.id
        await tx.metaAdAccount.upsert({
          where: {
            metaAccountId_adAccountId: {
              metaAccountId: accountRecord.id,
              adAccountId: normalizedAdAccountId,
            },
          },
          create: {
            metaAccountId: accountRecord.id,
            adAccountId: normalizedAdAccountId,
            adAccountName: aa.name ?? null,
            accountStatus: aa.account_status ?? 1,
            currency: aa.currency ?? null,
            timezoneName: aa.timezone_name ?? null,
            isDefault: false,
            lastSyncedAt: now,
          },
          update: {
            adAccountName: aa.name ?? null,
            accountStatus: aa.account_status ?? 1,
            currency: aa.currency ?? null,
            timezoneName: aa.timezone_name ?? null,
            lastSyncedAt: now,
          },
        })
      }

      for (const page of pages.data ?? []) {
        await tx.metaPage.upsert({
          where: {
            metaAccountId_pageId: {
              metaAccountId: accountRecord.id,
              pageId: page.id,
            },
          },
          create: {
            metaAccountId: accountRecord.id,
            pageId: page.id,
            pageName: page.name ?? null,
            pageAccessTokenEncrypted: page.access_token ? encode(page.access_token) : null,
            igBusinessAccountId: page.instagram_business_account?.id ?? null,
            igUsername: page.instagram_business_account?.username ?? null,
            igName: page.instagram_business_account?.name ?? null,
            isActive: true,
            lastSyncedAt: now,
          },
          update: {
            pageName: page.name ?? null,
            pageAccessTokenEncrypted: page.access_token ? encode(page.access_token) : null,
            igBusinessAccountId: page.instagram_business_account?.id ?? null,
            igUsername: page.instagram_business_account?.username ?? null,
            igName: page.instagram_business_account?.name ?? null,
            lastSyncedAt: now,
          },
        })
      }

      await tx.metaAccount.update({
        where: { id: accountRecord.id },
        data: {
          lastSyncAt: now,
          status: 'connected',
          notes: null,
        },
      })
    })

    const res = NextResponse.redirect(buildMetaConnectionsUrl(base, { connected: '1' }))
    res.cookies.set('meta_oauth_state', '', { maxAge: 0, path: '/' })
    return res
  } catch (err) {
    if (accountIdForFailure) {
      await prisma.metaAccount.updateMany({
        where: { id: accountIdForFailure, userId: auth.id },
        data: {
          status: 'needs_reconnect',
          notes: err instanceof Error ? err.message : 'Facebook connect gagal saat sync aset',
        },
      })
    }

    const message = err instanceof MetaGraphError || err instanceof Error
      ? err.message
      : 'Facebook connect gagal'
    return fail(message)
  }
}
