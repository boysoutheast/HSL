import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Fields to NEVER return to frontend (encrypted token/secret fields)
const SAFE_META_ACCOUNT_SELECT = {
  id: true,
  userId: true,
  name: true,
  appId: true,
  // appSecretEncrypted intentionally omitted
  // shortLivedTokenEncrypted intentionally omitted
  // longLivedTokenEncrypted intentionally omitted
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
  businesses: {
    select: {
      id: true,
      businessId: true,
      businessName: true,
      verificationStatus: true,
      isSelected: true,
      lastSyncedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  adAccounts: {
    select: {
      id: true,
      adAccountId: true,
      adAccountName: true,
      accountStatus: true,
      currency: true,
      timezoneName: true,
      isDefault: true,
      enabledForAutomation: true,
      lastSyncedAt: true,
      createdAt: true,
      updatedAt: true,
      business: {
        select: {
          id: true,
          businessId: true,
          businessName: true,
        },
      },
    },
  },
  pages: {
    select: {
      id: true,
      pageId: true,
      pageName: true,
      igBusinessAccountId: true,
      igUsername: true,
      igName: true,
      isActive: true,
      lastSyncedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  },
}

// Token fields that must NEVER be written directly via PATCH — use test-credentials endpoint
const TOKEN_FIELDS = [
  'appSecretEncrypted',
  'shortLivedTokenEncrypted',
  'longLivedTokenEncrypted',
  'tokenExpiry',
]

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const metaAccount = await prisma.metaAccount.findFirst({
    where: {
      id: params.id,
      ...(auth.role === 'admin' ? {} : { userId: auth.id }),
    },
    select: SAFE_META_ACCOUNT_SELECT,
  })

  if (!metaAccount) {
    return NextResponse.json({ error: 'MetaConnection not found' }, { status: 404 })
  }

  return NextResponse.json({ metaAccount })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  // Verify ownership first
  const existing = await prisma.metaAccount.findFirst({
    where: {
      id: params.id,
      ...(auth.role === 'admin' ? {} : { userId: auth.id }),
    },
  })

  if (!existing) {
    return NextResponse.json({ error: 'MetaConnection not found' }, { status: 404 })
  }

  let body: {
    name?: string
    appId?: string
    metaUserId?: string
    metaUserName?: string
    scopesJson?: string
    defaultAdAccountId?: string
    accountName?: string
    currency?: string
    timezone?: string
    pixelId?: string
    status?: string
    notes?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Reject any attempt to write token fields directly
  const tokenFieldsInBody = TOKEN_FIELDS.filter((f) => f in body)
  if (tokenFieldsInBody.length > 0) {
    return NextResponse.json(
      { error: `Token fields cannot be updated directly. Use /test-credentials endpoint: ${tokenFieldsInBody.join(', ')}` },
      { status: 400 },
    )
  }

  const updateData: Record<string, unknown> = {}
  if (body.name !== undefined) updateData.name = body.name?.trim().slice(0, 200) ?? undefined
  if (body.appId !== undefined) updateData.appId = body.appId?.trim().slice(0, 100) ?? undefined
  if (body.metaUserId !== undefined) updateData.metaUserId = body.metaUserId?.trim().slice(0, 100) ?? undefined
  if (body.metaUserName !== undefined) updateData.metaUserName = body.metaUserName?.trim().slice(0, 200) ?? undefined
  if (body.scopesJson !== undefined) updateData.scopesJson = body.scopesJson?.trim().slice(0, 50000) ?? null
  if (body.defaultAdAccountId !== undefined) updateData.defaultAdAccountId = body.defaultAdAccountId?.trim().slice(0, 100) ?? undefined
  if (body.accountName !== undefined) updateData.accountName = body.accountName?.trim().slice(0, 200) ?? undefined
  if (body.currency !== undefined) updateData.currency = body.currency?.trim().slice(0, 50) ?? undefined
  if (body.timezone !== undefined) updateData.timezone = body.timezone?.trim().slice(0, 50) ?? undefined
  if (body.pixelId !== undefined) updateData.pixelId = body.pixelId?.trim().slice(0, 100) ?? undefined
  if (typeof body.status === 'string' && ['connected', 'expired', 'needs_reconnect', 'revoked'].includes(body.status)) {
    updateData.status = body.status
  }
  if (body.notes !== undefined) updateData.notes = body.notes?.trim().slice(0, 2000) ?? null

  const metaAccount = await prisma.metaAccount.update({
    where: { id: params.id },
    data: updateData,
    select: SAFE_META_ACCOUNT_SELECT,
  })

  return NextResponse.json({ metaAccount })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const existing = await prisma.metaAccount.findFirst({
    where: {
      id: params.id,
      ...(auth.role === 'admin' ? {} : { userId: auth.id }),
    },
  })

  if (!existing) {
    return NextResponse.json({ error: 'MetaConnection not found' }, { status: 404 })
  }

  const relatedLaunchCount = await prisma.testLaunch.count({
    where: { metaAccountId: params.id },
  })

  if (relatedLaunchCount > 0) {
    return NextResponse.json(
      {
        error: `Koneksi tidak bisa dihapus karena masih dipakai ${relatedLaunchCount} test launch. Hapus atau pindahkan test launch dulu.`,
        code: 'META_CONNECTION_IN_USE',
        relatedLaunchCount,
      },
      { status: 409 },
    )
  }

  // Cascade delete: businesses, adAccounts, pages have onDelete: Cascade.
  // test_launches still RESTRICT by DB migration, so guard above is required.
  await prisma.metaAccount.delete({
    where: { id: params.id },
  })

  return NextResponse.json({ success: true })
}
