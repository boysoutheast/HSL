import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// ── GET /api/admin/auto-reply ───────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const metaAccountId = searchParams.get('metaAccountId')
  const isActive = searchParams.get('isActive')
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '50')

  const where: Record<string, unknown> = {}
  if (metaAccountId) where.metaAccountId = metaAccountId
  if (isActive !== null && isActive !== undefined) {
    where.isActive = isActive === 'true'
  }

  const [rules, total] = await Promise.all([
    prisma.autoReplyRule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        metaPage: { select: { pageName: true, pageId: true } },
        metaAccount: { select: { id: true, name: true } },
      },
    }),
    prisma.autoReplyRule.count({ where }),
  ])

  return NextResponse.json({ rules, total, page, pages: Math.ceil(total / limit) })
}

// ── POST /api/admin/auto-reply ─────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    metaAccountId: string
    metaPageId?: string
    name: string
    triggerType?: string
    triggerValue: string
    responseType?: string
    responseValue: string
    isActive?: boolean
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { metaAccountId, metaPageId, name, triggerValue, responseValue } = body

  if (!metaAccountId || !name || !triggerValue || !responseValue) {
    return NextResponse.json(
      { error: 'metaAccountId, name, triggerValue, and responseValue are required' },
      { status: 400 },
    )
  }

  // Verify metaAccountId belongs to user (unless admin)
  if (auth.role !== 'admin') {
    const account = await prisma.metaAccount.findFirst({
      where: { id: metaAccountId, userId: auth.id },
    })
    if (!account) {
      return NextResponse.json({ error: 'Meta account not found' }, { status: 404 })
    }
  }

  const rule = await prisma.autoReplyRule.create({
    data: {
      metaAccountId,
      metaPageId: metaPageId ?? null,
      name,
      triggerType: body.triggerType ?? 'contains',
      triggerValue,
      responseType: body.responseType ?? 'static',
      responseValue,
      isActive: body.isActive ?? true,
    },
    include: {
      metaPage: { select: { pageName: true, pageId: true } },
      metaAccount: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ rule }, { status: 201 })
}
