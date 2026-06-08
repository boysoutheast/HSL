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

  const metaAccount = await prisma.metaAccount.update({
    where: { id: params.id },
    data: body,
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

  // Cascade delete: businesses, adAccounts, pages have onDelete: Cascade
  await prisma.metaAccount.delete({
    where: { id: params.id },
  })

  return NextResponse.json({ success: true })
}
