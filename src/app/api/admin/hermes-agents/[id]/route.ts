import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashApiKey, requireAdmin } from '@/lib/auth'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const agent = await prisma.hermesAgent.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      status: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      assignments: {
        where: { status: 'active' },
        select: { id: true, assignableType: true, assignableId: true },
      },
      _count: { select: { contentLogs: true } },
    },
  })

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  return NextResponse.json({ agent })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    name?: string
    status?: string
    notes?: string
    rotateApiKey?: boolean
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { rotateApiKey, ...rawBody } = body

  // Allowlist: only these fields can be updated (mass assignment protection)
  const allowedUpdate: Record<string, unknown> = {}
  if (typeof rawBody.name === 'string') allowedUpdate.name = rawBody.name.trim().slice(0, 100)
  if (typeof rawBody.status === 'string' && ['active', 'inactive'].includes(rawBody.status)) {
    allowedUpdate.status = rawBody.status
  }
  if (typeof rawBody.notes === 'string') allowedUpdate.notes = rawBody.notes.trim().slice(0, 1000)

  let newRawApiKey: string | undefined
  if (rotateApiKey) {
    newRawApiKey = randomBytes(32).toString('hex')
    allowedUpdate.apiKeyHash = hashApiKey(newRawApiKey)
  }

  const agent = await prisma.hermesAgent.update({
    where: { id: params.id },
    data: allowedUpdate,
    select: {
      id: true,
      name: true,
      status: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({
    agent,
    ...(newRawApiKey ? { newApiKey: newRawApiKey } : {}),
  })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  await prisma.hermesAgent.update({
    where: { id: params.id },
    data: { status: 'inactive' },
  })

  return NextResponse.json({ success: true })
}
