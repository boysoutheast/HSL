import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const instagramAccountId = searchParams.get('instagramAccountId')
  const status = searchParams.get('status')

  // non-admin: filter via account ownership
  const ownershipFilter =
    auth.role === 'admin'
      ? {}
      : { instagramAccount: { createdByUserId: auth.id } }

  const characters = await prisma.character.findMany({
    where: {
      ...ownershipFilter,
      ...(instagramAccountId ? { instagramAccountId } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      instagramAccount: { select: { id: true, username: true } },
      photoReferences: { where: { status: 'active' } },
      _count: { select: { topics: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ characters })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    instagramAccountId: string
    name: string
    description: string
    behavior?: string
    speakingStyle?: string
    expressionStyle?: string
    movementStyle?: string
    forbiddenRules?: string
    status?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.instagramAccountId || !body.name || !body.description) {
    return NextResponse.json(
      { error: 'instagramAccountId, name, and description are required' },
      { status: 400 },
    )
  }

  // Verify account belongs to this user (non-admin)
  if (auth.role !== 'admin') {
    const account = await prisma.instagramAccount.findFirst({
      where: { id: body.instagramAccountId, createdByUserId: auth.id },
    })
    if (!account) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const character = await prisma.character.create({
    data: {
      instagramAccountId: body.instagramAccountId,
      name: body.name,
      description: body.description,
      behavior: body.behavior,
      speakingStyle: body.speakingStyle,
      expressionStyle: body.expressionStyle,
      movementStyle: body.movementStyle,
      forbiddenRules: body.forbiddenRules,
      status: body.status ?? 'active',
    },
  })

  return NextResponse.json({ character }, { status: 201 })
}
