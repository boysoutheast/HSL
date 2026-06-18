import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashApiKey } from '@/lib/auth'
import { requireAuth } from '@/lib/auth'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  // admin sees all agents; non-admin sees only their own
  if (auth.role !== 'admin') where.ownerUserId = auth.id

  const agents = await prisma.hermesAgent.findMany({
    where,
    select: {
      id: true,
      name: true,
      status: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { assignments: true, contentLogs: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ agents })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    name: string
    notes?: string
    status?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const rawApiKey = randomBytes(32).toString('hex')
  const apiKeyHash = hashApiKey(rawApiKey)

  const agent = await prisma.hermesAgent.create({
    data: {
      name: body.name,
      apiKeyHash,
      status: body.status ?? 'active',
      notes: body.notes,
      ownerUserId: auth.id,
    },
    select: {
      id: true,
      name: true,
      status: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ agent, apiKey: rawApiKey }, { status: 201 })
}
