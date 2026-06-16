import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

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
  adAccounts: { select: { id: true, adAccountId: true, adAccountName: true, accountStatus: true, currency: true, timezoneName: true, isDefault: true, lastSyncedAt: true, createdAt: true, updatedAt: true, business: { select: { id: true, businessId: true, businessName: true } } } },
  pages: { select: { id: true, pageId: true, pageName: true, igBusinessAccountId: true, igUsername: true, igName: true, isActive: true, lastSyncedAt: true, createdAt: true, updatedAt: true } },
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const metaAccount = await prisma.metaAccount.findUnique({
    where: { id: params.id },
    select: SAFE_META_ACCOUNT_SELECT,
  })

  if (!metaAccount) {
    return NextResponse.json({ error: 'MetaAccount not found' }, { status: 404 })
  }

  // non-admin: verify ownership
  if (auth.role !== 'admin' && metaAccount.userId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ metaAccount })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    adAccountId?: string
    accessToken?: string
    accountName?: string
    pageId?: string
    igAccountId?: string
    pixelId?: string
    currency?: string
    timezone?: string
    notes?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Check ownership
  const existing = await prisma.metaAccount.findUnique({
    where: { id: params.id },
    select: SAFE_META_ACCOUNT_SELECT,
  })

  if (!existing) {
    return NextResponse.json({ error: 'MetaAccount not found' }, { status: 404 })
  }

  if (auth.role !== 'admin' && existing.userId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updateData: Record<string, unknown> = {}
  if (body.adAccountId !== undefined) updateData.adAccountId = body.adAccountId
  if (body.accessToken !== undefined) updateData.accessToken = body.accessToken
  if (body.accountName !== undefined) updateData.accountName = body.accountName?.trim().slice(0, 200) ?? undefined
  if (body.pageId !== undefined) updateData.pageId = body.pageId
  if (body.igAccountId !== undefined) updateData.igAccountId = body.igAccountId
  if (body.pixelId !== undefined) updateData.pixelId = body.pixelId
  if (body.currency !== undefined) updateData.currency = body.currency?.trim().slice(0, 50) ?? undefined
  if (body.timezone !== undefined) updateData.timezone = body.timezone?.trim().slice(0, 50) ?? undefined
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

  const metaAccount = await prisma.metaAccount.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true },
  })

  if (!metaAccount) {
    return NextResponse.json({ error: 'MetaAccount not found' }, { status: 404 })
  }
  // non-admin: verify ownership
  if (auth.role !== 'admin' && metaAccount.userId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // soft delete — just set status to revoked
  await prisma.metaAccount.update({
    where: { id: params.id },
    data: { status: 'revoked' },
  })

  return NextResponse.json({ success: true })
}
