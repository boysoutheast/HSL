import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, ownerFilter } from '@/lib/auth'
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
  businesses: { select: { id: true, businessId: true, businessName: true, verificationStatus: true, isSelected: true, lastSyncedAt: true, createdAt: true, updatedAt: true } },
  adAccounts: { select: { id: true, adAccountId: true, adAccountName: true, accountStatus: true, currency: true, timezoneName: true, isDefault: true, enabledForAutomation: true, lastSyncedAt: true, createdAt: true, updatedAt: true, business: { select: { id: true, businessId: true, businessName: true } } } },
  pages: { select: { id: true, pageId: true, pageName: true, igBusinessAccountId: true, igUsername: true, igName: true, isActive: true, lastSyncedAt: true, createdAt: true, updatedAt: true } },
}

async function debugToken(appId: string, appSecret: string, token: string) {
  const url = new URL('https://graph.facebook.com/v21.0/debug_token')
  url.searchParams.set('input_token', token)
  url.searchParams.set('access_token', `${appId}|${appSecret}`)
  const res = await fetch(url, { cache: 'no-store' })
  const data = await res.json()
  if (!res.ok || !data?.data?.is_valid) throw new Error(safeMetaError(data))
  return data.data
}

async function getMe(token: string) {
  const url = new URL('https://graph.facebook.com/v21.0/me')
  url.searchParams.set('fields', 'id,name')
  url.searchParams.set('access_token', token)
  const res = await fetch(url, { cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) throw new Error(safeMetaError(data))
  return data
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  const metaAccounts = await prisma.metaAccount.findMany({ where: ownerFilter(auth, 'userId'), select: SAFE_META_ACCOUNT_SELECT, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ metaAccounts })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: { name?: string; appId?: string; appSecret?: string; userAccessToken?: string; defaultAdAccountId?: string; pixelId?: string; notes?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.appId || !body.appSecret || !body.userAccessToken) {
    return NextResponse.json({ error: 'appId, appSecret, and userAccessToken are required' }, { status: 400 })
  }

  let resolvedMetaUserId: string | null = null
  try {
    const tokenData = await debugToken(body.appId, body.appSecret, body.userAccessToken)
    const me = await getMe(body.userAccessToken)
    resolvedMetaUserId = me.id ?? tokenData.user_id ?? null
    const now = new Date()
    const metaAccount = await prisma.metaAccount.create({
      data: {
        userId: auth.id,
        name: body.name ?? `Meta ${me.name ?? me.id}`,
        appId: body.appId,
        appSecretEncrypted: encode(body.appSecret),
        shortLivedTokenEncrypted: encode(body.userAccessToken),
        longLivedTokenEncrypted: encode(body.userAccessToken),
        tokenExpiry: tokenData.expires_at ? new Date(tokenData.expires_at * 1000) : null,
        metaUserId: resolvedMetaUserId,
        metaUserName: me.name ?? null,
        scopesJson: JSON.stringify(tokenData.scopes ?? []),
        defaultAdAccountId: body.defaultAdAccountId,
        pixelId: body.pixelId,
        status: 'connected',
        lastMetaCallAt: now,
        lastTokenCheckAt: now,
        notes: body.notes,
      },
      select: SAFE_META_ACCOUNT_SELECT,
    })
    return NextResponse.json({ metaAccount }, { status: 201 })
  } catch (e) {
    if (e instanceof Error && 'code' in e && (e as { code?: string }).code === 'P2002') {
      const existing = await prisma.metaAccount.findFirst({
        where: { userId: auth.id, ...(resolvedMetaUserId ? { metaUserId: resolvedMetaUserId } : {}) },
        select: { id: true, name: true },
      }).catch(() => null)
      return NextResponse.json({
        error: `Akun Meta ini sudah terhubung sebelumnya${existing?.name ? ` (${existing.name})` : ''}.`,
        existingId: existing?.id ?? null,
      }, { status: 409 })
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to connect Meta account' }, { status: 400 })
  }
}
