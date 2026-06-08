import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateHermesApiKey, extractBearerToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) {
    return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
  }

  const agent = await validateHermesApiKey(token)
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401 })
  }

  let body: {
    topicId?: string
    productId?: string
    cepText: string
    painPoint?: string
    angle?: string
    notes?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.cepText) {
    return NextResponse.json({ error: 'cepText is required' }, { status: 400 })
  }

  if (!body.topicId && !body.productId) {
    return NextResponse.json(
      { error: 'Either topicId or productId is required' },
      { status: 400 },
    )
  }

  // Verify topic or product is assigned to this agent
  if (body.topicId) {
    const topicAssignment = await prisma.assignment.findFirst({
      where: {
        hermesAgentId: agent.id,
        assignableType: 'topic',
        assignableId: body.topicId,
        status: 'active',
      },
    })
    if (!topicAssignment) {
      return NextResponse.json(
        { error: 'Topic not assigned to this agent' },
        { status: 403 },
      )
    }
  }

  if (body.productId) {
    const productAssignment = await prisma.assignment.findFirst({
      where: {
        hermesAgentId: agent.id,
        assignableType: 'product',
        assignableId: body.productId,
        status: 'active',
      },
    })
    if (!productAssignment) {
      return NextResponse.json(
        { error: 'Product not assigned to this agent' },
        { status: 403 },
      )
    }
  }

  // Check for duplicate cepText on same topic/product
  const existing = await prisma.cep.findFirst({
    where: {
      cepText: body.cepText,
      topicId: body.topicId ?? null,
      productId: body.productId ?? null,
    },
  })

  if (existing) {
    return NextResponse.json(
      { error: 'Duplicate CEP text for this topic/product' },
      { status: 409 },
    )
  }

  const cep = await prisma.cep.create({
    data: {
      topicId: body.topicId,
      productId: body.productId,
      cepText: body.cepText,
      painPoint: body.painPoint,
      angle: body.angle,
      source: 'ai',
      createdByHermesId: agent.id,
      status: 'active',
      notes: body.notes,
    },
  })

  return NextResponse.json({ cep }, { status: 201 })
}
