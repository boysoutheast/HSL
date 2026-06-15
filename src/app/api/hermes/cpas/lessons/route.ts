import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateHermesApiKey, extractBearerToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function authenticate(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) return null
  return validateHermesApiKey(token)
}

export async function GET(req: NextRequest) {
  const agent = await authenticate(req)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const productKey = searchParams.get('productKey') ?? undefined
  const lessonType = searchParams.get('lessonType') ?? undefined
  const status = searchParams.get('status') ?? 'active'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)

  const lessons = await prisma.cpasLesson.findMany({
    where: {
      ...(productKey && { productKey }),
      ...(lessonType && { lessonType }),
      status,
    },
    orderBy: [{ evidenceCount: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  })

  return NextResponse.json({ lessons })
}

export async function POST(req: NextRequest) {
  const agent = await authenticate(req)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    userId: string
    productKey?: string
    lessonType: string
    title: string
    body: string
    confidence?: string
    evidenceCount?: number
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.userId || !body.lessonType || !body.title || !body.body) {
    return NextResponse.json({ error: 'userId, lessonType, title, body are required' }, { status: 400 })
  }

  const lesson = await prisma.cpasLesson.create({
    data: {
      userId: body.userId,
      productKey: body.productKey ?? null,
      lessonType: body.lessonType,
      title: body.title,
      body: body.body,
      confidence: body.confidence ?? 'medium',
      evidenceCount: body.evidenceCount ?? 1,
    },
  })

  return NextResponse.json({ id: lesson.id }, { status: 201 })
}
