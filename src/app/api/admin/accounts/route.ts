import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, ownerFilter } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const accounts = await prisma.instagramAccount.findMany({
    where: {
      ...ownerFilter(auth),
      ...(status ? { status } : {}),
    },
    include: {
      postingMonitor: true,
      _count: { select: { characters: true, contentLogs: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ accounts })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    username: string
    accountName?: string
    gender?: string
    status?: string
    purpose?: string
    notes?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.username) {
    return NextResponse.json({ error: 'username is required' }, { status: 400 })
  }

  const account = await prisma.instagramAccount.create({
    data: {
      username: body.username,
      accountName: body.accountName,
      gender: body.gender ?? null,
      status: body.status ?? 'active',
      purpose: body.purpose,
      notes: body.notes,
      createdByUserId: auth.id,
    },
  })

  return NextResponse.json({ account }, { status: 201 })
}
