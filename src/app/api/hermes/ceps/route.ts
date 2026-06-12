import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateHermesApiKey, extractBearerToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/hermes/ceps — list active CEPs for all products/topics assigned to this agent
export async function GET(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) {
    return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
  }

  const agent = await validateHermesApiKey(token)
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const filterProductId = searchParams.get('productId')
  const filterTopicId   = searchParams.get('topicId')
  const limit           = Math.min(parseInt(searchParams.get('limit')  ?? '100'), 200)
  const offset          = parseInt(searchParams.get('offset') ?? '0')

  const assignments = await prisma.assignment.findMany({
    where: { hermesAgentId: agent.id, status: 'active' },
  })

  const directCepIds = assignments
    .filter(a => a.assignableType === 'cep')
    .map(a => a.assignableId)

  const assignedProductIds = assignments
    .filter(a => a.assignableType === 'product')
    .map(a => a.assignableId)

  const directTopicIds = assignments
    .filter(a => a.assignableType === 'topic')
    .map(a => a.assignableId)

  const characterIds = assignments
    .filter(a => a.assignableType === 'character')
    .map(a => a.assignableId)

  let characterTopicIds: string[] = []
  if (characterIds.length > 0) {
    const topics = await prisma.topic.findMany({
      where: { characterId: { in: characterIds }, status: 'active' },
      select: { id: true },
    })
    characterTopicIds = topics.map(t => t.id)
  }

  const assignedTopicIds = Array.from(new Set([...directTopicIds, ...characterTopicIds]))

  if (filterProductId) {
    if (!assignedProductIds.includes(filterProductId)) {
      return NextResponse.json({ error: 'Forbidden: productId is out of scope for this agent' }, { status: 403 })
    }

    const [ceps, total] = await Promise.all([
      prisma.cep.findMany({
        where: { status: 'active', productId: filterProductId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true, cepText: true, painPoint: true, angle: true,
          source: true, status: true, createdByHermesId: true, createdAt: true,
          topicId: true, productId: true,
          topic:   { select: { name: true } },
          product: { select: { name: true } },
        },
      }),
      prisma.cep.count({ where: { status: 'active', productId: filterProductId } }),
    ])
    return NextResponse.json({ ceps, total, limit, offset })
  }

  if (filterTopicId) {
    if (!assignedTopicIds.includes(filterTopicId)) {
      return NextResponse.json({ error: 'Forbidden: topicId is out of scope for this agent' }, { status: 403 })
    }

    const [ceps, total] = await Promise.all([
      prisma.cep.findMany({
        where: { status: 'active', topicId: filterTopicId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true, cepText: true, painPoint: true, angle: true,
          source: true, status: true, createdByHermesId: true, createdAt: true,
          topicId: true, productId: true,
          topic:   { select: { name: true } },
          product: { select: { name: true } },
        },
      }),
      prisma.cep.count({ where: { status: 'active', topicId: filterTopicId } }),
    ])
    return NextResponse.json({ ceps, total, limit, offset })
  }

  if (directCepIds.length === 0 && assignedProductIds.length === 0 && assignedTopicIds.length === 0) {
    return NextResponse.json({ ceps: [], total: 0, limit, offset })
  }

  const whereClause = {
    status: 'active',
    OR: [
      ...(directCepIds.length > 0 ? [{ id: { in: directCepIds } }] : []),
      ...(assignedProductIds.length > 0 ? [{ productId: { in: assignedProductIds } }] : []),
      ...(assignedTopicIds.length > 0 ? [{ topicId: { in: assignedTopicIds } }] : []),
    ],
  }

  const [ceps, total] = await Promise.all([
    prisma.cep.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true, cepText: true, painPoint: true, angle: true,
        source: true, status: true, createdByHermesId: true, createdAt: true,
        topicId: true, productId: true,
        topic:   { select: { name: true } },
        product: { select: { name: true } },
      },
    }),
    prisma.cep.count({ where: whereClause }),
  ])

  return NextResponse.json({ ceps, total, limit, offset })
}

// POST /api/hermes/ceps — submit a new CEP from a Hermes agent (status: active immediately)
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
    cepText: string
    painPoint?: string
    angle?: string
    topicId?: string
    productId?: string
    notes?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.cepText?.trim()) {
    return NextResponse.json({ error: 'cepText is required' }, { status: 400 })
  }

  if (!body.topicId && !body.productId) {
    return NextResponse.json({ error: 'topicId or productId is required' }, { status: 400 })
  }

  const cep = await prisma.cep.create({
    data: {
      cepText: body.cepText.trim(),
      painPoint: body.painPoint?.trim() || null,
      angle: body.angle?.trim() || null,
      notes: body.notes?.trim() || null,
      source: 'ai',
      status: 'active',
      createdByHermesId: agent.id,
      ...(body.topicId   ? { topicId: body.topicId }     : {}),
      ...(body.productId ? { productId: body.productId } : {}),
    },
  })

  return NextResponse.json({ cep, message: 'CEP created and active' }, { status: 201 })
}
