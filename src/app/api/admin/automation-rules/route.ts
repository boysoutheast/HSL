import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const where: Record<string, unknown> = { userId: auth.id }
  if (status) where.status = status

  const rules = await prisma.automationRule.findMany({
    where,
    include: {
      campaignSession: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ rules })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    name: string
    description?: string
    scope: string
    ruleCategory: string
    conditionTreeJson: Record<string, unknown>
    actionSpecJson: Record<string, unknown>
    cooldownMinutes?: number
    campaignSessionId?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.name || !body.scope || !body.ruleCategory) {
    return NextResponse.json(
      { error: 'name, scope, and ruleCategory are required' },
      { status: 400 }
    )
  }

  if (!body.conditionTreeJson || !body.actionSpecJson) {
    return NextResponse.json(
      { error: 'conditionTreeJson and actionSpecJson are required' },
      { status: 400 }
    )
  }

  const rule = await prisma.automationRule.create({
    data: {
      userId: auth.id,
      name: body.name,
      description: body.description ?? null,
      scope: body.scope,
      ruleCategory: body.ruleCategory,
      conditionTreeJson: JSON.stringify(body.conditionTreeJson),
      actionSpecJson: JSON.stringify(body.actionSpecJson),
      cooldownMinutes: body.cooldownMinutes ?? 60,
      campaignSessionId: body.campaignSessionId ?? null,
      status: 'DRAFT',
    },
    include: {
      campaignSession: {
        select: { id: true, name: true },
      },
    },
  })

  return NextResponse.json({ rule }, { status: 201 })
}
