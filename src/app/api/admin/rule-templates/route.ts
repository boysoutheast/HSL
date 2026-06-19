import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/admin/rule-templates
 * List available rule templates — built-in + user's own.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const templates = await prisma.ruleTemplate.findMany({
    where: {
      OR: [
        { userId: null },                    // built-in templates
        { userId: auth.id },                  // user's own templates
      ],
    },
    orderBy: [
      { isBuiltin: 'desc' },
      { usageCount: 'desc' },
    ],
    select: {
      id: true,
      name: true,
      description: true,
      scope: true,
      ruleCategory: true,
      conditionTreeJson: true,
      actionSpecJson: true,
      isBuiltin: true,
      usageCount: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ templates })
}
