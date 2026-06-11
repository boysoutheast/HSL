import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/admin/rule-templates — builtin + milik user
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const templates = await prisma.ruleTemplate.findMany({
    where: {
      OR: [
        { isBuiltin: true },
        { userId: auth.id },
      ],
    },
    orderBy: [{ isBuiltin: 'desc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json({ templates })
}

// POST /api/admin/rule-templates — save custom template (dari rule atau dari builder)
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const { name, description, scope, ruleCategory, conditionTreeJson, actionSpecJson } = body
  if (!name?.trim() || !scope || !ruleCategory || !conditionTreeJson || !actionSpecJson) {
    return NextResponse.json(
      { error: 'name, scope, ruleCategory, conditionTreeJson, actionSpecJson are required' },
      { status: 400 }
    )
  }

  const template = await prisma.ruleTemplate.create({
    data: {
      userId: auth.id,
      name: name.trim(),
      description: description?.trim() || null,
      scope,
      ruleCategory,
      conditionTreeJson: typeof conditionTreeJson === 'string' ? conditionTreeJson : JSON.stringify(conditionTreeJson),
      actionSpecJson: typeof actionSpecJson === 'string' ? actionSpecJson : JSON.stringify(actionSpecJson),
      isBuiltin: false,
    },
  })

  return NextResponse.json({ template }, { status: 201 })
}
