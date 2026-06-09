import { NextRequest, NextResponse } from 'next/server'
import { encode, decode } from '@/lib/crypto'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const GRAPH = 'https://graph.facebook.com/v21.0'

async function metaGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${GRAPH}/${path}`)
  url.searchParams.set('access_token', token)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return fetch(url, { cache: 'no-store' })
}

async function extendToken(appId: string, appSecret: string, shortToken: string) {
  const url = new URL(`${GRAPH}/oauth/access_token`)
  url.searchParams.set('grant_type', 'fb_exchange_token')
  url.searchParams.set('client_id', appId)
  url.searchParams.set('client_secret', appSecret)
  url.searchParams.set('fb_exchange_token', shortToken)
  const r = await fetch(url, { cache: 'no-store' })
  return r.json()
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const state = searchParams.get('state')

  if (error) {
    return NextResponse.redirect(
      new URL(`/meta-connections/new?error=${encodeURIComponent(error_description ?? error)}`, req.url)
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/meta-connections/new?error=missing_params', req.url))
  }

  let stateData: {
    userId: string
    metaAccountId: string | null
    type: string
    appId: string
    appSecret: string
    redirectBase: string
  }

  try {
    const decoded = decode(state)
    stateData = JSON.parse(decoded)
  } catch {
    return NextResponse.redirect(new URL('/meta-connections/new?error=invalid_state', req.url))
  }

  const { userId, metaAccountId, type, appId, appSecret } = stateData
  const callbackUrl = `${stateData.redirectBase}/api/admin/auth/meta/callback`

  try {
    // Step 1: Exchange code for short-lived User Token
    const tokenUrl = new URL(`${GRAPH}/oauth/access_token`)
    tokenUrl.searchParams.set('client_id', appId)
    tokenUrl.searchParams.set('client_secret', appSecret)
    tokenUrl.searchParams.set('redirect_uri', callbackUrl)
    tokenUrl.searchParams.set('code', code)

    const tokenRes = await fetch(tokenUrl, { cache: 'no-store' })
    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || tokenData.error) {
      throw new Error((tokenData.error?.message) ?? 'Token exchange failed')
    }

    let userToken = tokenData.access_token as string

    // Step 2: Extend to long-lived (60 days)
    if (appSecret) {
      const extended = await extendToken(appId, appSecret, userToken)
      if (extended.access_token) {
        userToken = extended.access_token
      }
    }

    // Step 3: Get User info
    const meRes = await metaGet('me', userToken, { fields: 'id,name' })
    const meData = await meRes.json()
    const metaUserId = meData.id ?? ''
    const metaUserName = meData.name ?? ''

    // Step 4: Fetch Pages and Page Access Tokens
    const pageRes = await metaGet(
      'me/accounts',
      userToken,
      { fields: 'id,name,access_token,instagram_business_account{id,username,name}', limit: '100' }
    )
    const pageData = await pageRes.json()

    if (!pageRes.ok) {
      throw new Error('Failed to fetch pages: ' + (pageData.error?.message ?? pageRes.status))
    }

    const pages = pageData.data ?? []

    if (pages.length === 0) {
      return NextResponse.redirect(
        new URL('/meta-connections/new?error=no_pages_found', req.url)
      )
    }

    // Step 5: Upsert MetaAccount
    const now = new Date()
    const scopes = tokenData.granted_scopes
      ? tokenData.granted_scopes.join(',')
      : type === 'instagram'
      ? 'instagram_basic,pages_show_list'
      : 'pages_show_list'

    let metaAccount

    if (metaAccountId) {
      metaAccount = await prisma.metaAccount.update({
        where: { id: metaAccountId },
        data: {
          shortLivedTokenEncrypted: encode(userToken),
          longLivedTokenEncrypted: encode(userToken),
          metaUserId,
          metaUserName,
          scopesJson: JSON.stringify(scopes.split(',')),
          tokenExpiry: tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000)
            : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          lastTokenCheckAt: now,
          status: 'connected',
        },
      })
    } else {
      metaAccount = await prisma.metaAccount.create({
        data: {
          userId,
          name: `Meta ${metaUserName ?? metaUserId}`,
          appId,
          appSecretEncrypted: appSecret ? encode(appSecret) : null,
          shortLivedTokenEncrypted: encode(userToken),
          longLivedTokenEncrypted: encode(userToken),
          metaUserId,
          metaUserName,
          scopesJson: JSON.stringify(scopes.split(',')),
          tokenExpiry: tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000)
            : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          lastTokenCheckAt: now,
          status: 'connected',
        },
      })
    }

    // Step 6: Upsert each Page with Page Access Token
    for (const pg of pages) {
      const ig = pg.instagram_business_account
      await prisma.metaPage.upsert({
        where: {
          metaAccountId_pageId: { metaAccountId: metaAccount.id, pageId: pg.id },
        },
        update: {
          pageName: pg.name,
          pageAccessTokenEncrypted: pg.access_token ? encode(pg.access_token) : undefined,
          igBusinessAccountId: ig?.id ?? null,
          igUsername: ig?.username ?? null,
          igName: ig?.name ?? null,
          lastSyncedAt: now,
          isActive: true,
        },
        create: {
          metaAccountId: metaAccount.id,
          pageId: pg.id,
          pageName: pg.name,
          pageAccessTokenEncrypted: pg.access_token ? encode(pg.access_token) : null,
          igBusinessAccountId: ig?.id ?? null,
          igUsername: ig?.username ?? null,
          igName: ig?.name ?? null,
          isActive: true,
          lastSyncedAt: now,
        },
      })
    }

    // Step 7: Sync Ad Accounts too
    const bizRes = await metaGet('me/businesses', userToken, { fields: 'id,name', limit: '100' })
    const bizData = await bizRes.json()
    if (bizRes.ok && bizData?.data) {
      for (const biz of bizData.data) {
        await prisma.metaBusiness.upsert({
          where: { metaAccountId_businessId: { metaAccountId: metaAccount.id, businessId: biz.id } },
          update: { businessName: biz.name, lastSyncedAt: now },
          create: { metaAccountId: metaAccount.id, businessId: biz.id, businessName: biz.name, isSelected: false, lastSyncedAt: now },
        })
      }
    }

    await prisma.metaAccount.update({
      where: { id: metaAccount.id },
      data: { lastSyncAt: now },
    })

    return NextResponse.redirect(
      new URL(`/meta-connections/${metaAccount.id}?success=oauth_complete`, req.url)
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'oauth_error'
    return NextResponse.redirect(
      new URL(`/meta-connections/new?error=${encodeURIComponent(msg)}`, req.url)
    )
  }
}
