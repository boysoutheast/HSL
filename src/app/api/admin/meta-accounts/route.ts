import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, ownerFilter } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const metaAccounts = await prisma.metaAccount.findMany({
    where: ownerFilter(auth, 'userId'),
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ metaAccounts })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    adAccountId: string
    accessToken: string
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

  if (!body.adAccountId || !body.accessToken) {
    return NextResponse.json({ error: 'adAccountId and accessToken are required' }, { status: 400 })
  }

  const metaAccount = await prisma.metaAccount.create({
    data: {
      adAccountId: body.adAccountId,
      accessToken: body.accessToken,
      accountName: body.accountName,
      pageId: body.pageId,
      igAccountId: body.igAccountId,
      pixelId: body.pixelId,
      currency: body.currency ?? 'IDR',
      timezone: body.timezone ?? 'Asia/Jakarta',
      notes: body.notes,
      userId: auth.id,
    },
  })

  return NextResponse.json({ metaAccount }, { status: 201 })
}
