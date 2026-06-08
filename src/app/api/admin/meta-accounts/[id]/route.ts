import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const metaAccount = await prisma.metaAccount.findUnique({
    where: { id: params.id },
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
  })

  if (!existing) {
    return NextResponse.json({ error: 'MetaAccount not found' }, { status: 404 })
  }

  if (auth.role !== 'admin' && existing.userId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const metaAccount = await prisma.metaAccount.update({
    where: { id: params.id },
    data: body,
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
  })

  if (!metaAccount) {
    return NextResponse.json({ error: 'MetaAccount not found' }, { status: 404 })
  }

  // non-admin: verify ownership
  if (auth.role !== 'admin' && metaAccount.userId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Soft delete: set status to 'revoked'
  await prisma.metaAccount.update({
    where: { id: params.id },
    data: { status: 'revoked' },
  })

  return NextResponse.json({ success: true })
}
