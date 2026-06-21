import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { encode, safeMetaError } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

const SAFE_META_ACCOUNT_SELECT = {
  id: true,
  userId: true,
  name: true,
  appId: true,
  tokenExpiry: true,
  metaUserId: true,
  metaUserName: true,
  scopesJson: true,
  defaultAdAccountId: true,
  accountName: true,
  currency: true,
  timezone: true,
  pixelId: true,
  status: true,
  lastMetaCallAt: true,
  lastTokenCheckAt: true,
  lastSyncAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  // Verify ownership
  const existing = await prisma.metaAccount.findFirst({
    where: {
      id: params.id,
      ...(auth.role === 'admin' ? {} : { userId: auth.id }),
    },
  })

  if (!existing) {
    return NextResponse.json({ error: 'MetaConnection not found' }, { status: 404 })
  }

  let body: { appSecret?: string; userAccessToken?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.appSecret || !body.userAccessToken) {
    return NextResponse.json(
      { error: 'appSecret and userAccessToken are required' },
      { status: 400 },
    )
  }

  // Validate against Meta API (reuses same logic as test-credentials)
  const appId = existing.appId
  if (!appId) {
    return NextResponse.json(
      { error: 'MetaConnection has no App ID. Edit metadata to set App ID first.' },
      { status: 400 },
    )
  }

  try {
    const url = new URL('https://graph.facebook.com/v21.0/debug_token')
    url.searchParams.set('input_token', body.userAccessToken)
    url.searchParams.set('access_token', `${appId}|${body.appSecret}`)
    const debugRes = await fetch(url, { method: 'GET', cache: 'no-store' })
    const debugData = await debugRes.json()

    if (!debugRes.ok || !debugData?.data?.is_valid) {
      return NextResponse.json(
        { valid: false, error: safeMetaError(debugData) },
        { status: 400 },
      )
    }

    const tokenData = debugData.data

    // Verify token works by calling /me
    const meUrl = new URL('https://graph.facebook.com/v21.0/me')
    meUrl.searchParams.set('fields', 'id,name')
    meUrl.searchParams.set('access_token', body.userAccessToken)
    const meRes = await fetch(meUrl, { cache: 'no-store' })
    const meData = await meRes.json()
    if (!meRes.ok) {
      return NextResponse.json(
        { valid: false, error: safeMetaError(meData) },
        { status: 400 },
      )
    }

    const now = new Date()
    const updated = await prisma.metaAccount.update({
      where: { id: params.id },
      data: {
        appSecretEncrypted: encode(body.appSecret),
        // Keep existing shortLivedTokenEncrypted as-is (it's the initial one from setup)
        // Update longLivedTokenEncrypted with the new token
        longLivedTokenEncrypted: encode(body.userAccessToken),
        tokenExpiry: tokenData.expires_at ? new Date(tokenData.expires_at * 1000) : null,
        metaUserId: meData.id ?? tokenData.user_id ?? undefined,
        metaUserName: meData.name ?? undefined,
        scopesJson: JSON.stringify(tokenData.scopes ?? []),
        status: 'connected',
        lastMetaCallAt: now,
        lastTokenCheckAt: now,
      },
      select: SAFE_META_ACCOUNT_SELECT,
    })

    return NextResponse.json({ metaAccount: updated })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to update credentials' },
      { status: 400 },
    )
  }
}
