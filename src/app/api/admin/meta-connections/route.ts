import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, ownerFilter } from '@/lib/auth'

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
  // relations
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
      // include business relation
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

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const metaAccounts = await prisma.metaAccount.findMany({
    where: ownerFilter(auth, 'userId'),
    select: SAFE_META_ACCOUNT_SELECT,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ metaAccounts })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    name?: string
    appId?: string
    appSecretEncrypted?: string
    shortLivedTokenEncrypted?: string
    longLivedTokenEncrypted?: string
    tokenExpiry?: string | null
    metaUserId?: string
    metaUserName?: string
    scopesJson?: string
    defaultAdAccountId?: string
    accountName?: string
    currency?: string
    timezone?: string
    pixelId?: string
    notes?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // At minimum userId comes from auth; appId is strongly recommended
  if (!body.appId) {
    return NextResponse.json({ error: 'appId is required' }, { status: 400 })
  }

  const metaAccount = await prisma.metaAccount.create({
    data: {
      userId: auth.id,
      name: body.name,
      appId: body.appId,
      appSecretEncrypted: body.appSecretEncrypted,
      shortLivedTokenEncrypted: body.shortLivedTokenEncrypted,
      longLivedTokenEncrypted: body.longLivedTokenEncrypted,
      tokenExpiry: body.tokenExpiry ? new Date(body.tokenExpiry) : null,
      metaUserId: body.metaUserId,
      metaUserName: body.metaUserName,
      scopesJson: body.scopesJson,
      defaultAdAccountId: body.defaultAdAccountId,
      accountName: body.accountName,
      currency: body.currency ?? 'IDR',
      timezone: body.timezone ?? 'Asia/Jakarta',
      pixelId: body.pixelId,
      notes: body.notes,
    },
    select: SAFE_META_ACCOUNT_SELECT,
  })

  return NextResponse.json({ metaAccount }, { status: 201 })
}
