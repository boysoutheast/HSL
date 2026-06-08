import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const VALID_ASSIGNABLE_TYPES = [
  'instagram_account',
  'character',
  'topic',
  'cep',
  'product',
] as const

type AssignableType = (typeof VALID_ASSIGNABLE_TYPES)[number]

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const hermesAgentId = searchParams.get('hermesAgentId')
  const assignableType = searchParams.get('assignableType')
  const status = searchParams.get('status')

  if (!hermesAgentId) {
    return NextResponse.json({ error: 'hermesAgentId is required' }, { status: 400 })
  }

  const assignments = await prisma.assignment.findMany({
    where: {
      hermesAgentId,
      ...(assignableType ? { assignableType } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      hermesAgent: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ assignments })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    hermesAgentId: string
    assignableType: AssignableType
    assignableId: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.hermesAgentId || !body.assignableType || !body.assignableId) {
    return NextResponse.json(
      { error: 'hermesAgentId, assignableType, and assignableId are required' },
      { status: 400 },
    )
  }

  if (!VALID_ASSIGNABLE_TYPES.includes(body.assignableType)) {
    return NextResponse.json(
      { error: `assignableType must be one of: ${VALID_ASSIGNABLE_TYPES.join(', ')}` },
      { status: 400 },
    )
  }

  // Verify entity exists
  const entityExists = await verifyEntityExists(body.assignableType, body.assignableId)
  if (!entityExists) {
    return NextResponse.json(
      { error: `${body.assignableType} with id ${body.assignableId} not found` },
      { status: 404 },
    )
  }

  const assignment = await prisma.assignment.upsert({
    where: {
      hermesAgentId_assignableType_assignableId: {
        hermesAgentId: body.hermesAgentId,
        assignableType: body.assignableType,
        assignableId: body.assignableId,
      },
    },
    create: {
      hermesAgentId: body.hermesAgentId,
      assignableType: body.assignableType,
      assignableId: body.assignableId,
      status: 'active',
    },
    update: {
      status: 'active',
    },
  })

  return NextResponse.json({ assignment }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const hermesAgentId = searchParams.get('hermesAgentId')
  const assignableType = searchParams.get('assignableType')
  const assignableId = searchParams.get('assignableId')
  const id = searchParams.get('id')

  if (id) {
    await prisma.assignment.update({
      where: { id },
      data: { status: 'inactive' },
    })
    return NextResponse.json({ success: true })
  }

  if (!hermesAgentId || !assignableType || !assignableId) {
    return NextResponse.json(
      { error: 'Either id or (hermesAgentId + assignableType + assignableId) are required' },
      { status: 400 },
    )
  }

  await prisma.assignment.updateMany({
    where: { hermesAgentId, assignableType, assignableId },
    data: { status: 'inactive' },
  })

  return NextResponse.json({ success: true })
}

async function verifyEntityExists(
  type: AssignableType,
  id: string,
): Promise<boolean> {
  switch (type) {
    case 'instagram_account':
      return !!(await prisma.instagramAccount.findUnique({ where: { id } }))
    case 'character':
      return !!(await prisma.character.findUnique({ where: { id } }))
    case 'topic':
      return !!(await prisma.topic.findUnique({ where: { id } }))
    case 'cep':
      return !!(await prisma.cep.findUnique({ where: { id } }))
    case 'product':
      return !!(await prisma.product.findUnique({ where: { id } }))
    default:
      return false
  }
}
