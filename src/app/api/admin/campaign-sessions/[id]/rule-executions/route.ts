import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/admin/campaign-sessions/[id]/rule-executions
 * List RuleExecutions for a campaign session, sorted by evaluatedAt desc.
 * Query params: limit (default 50)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const sessionId = params.id
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50), 200)

  // Verify session ownership
  const session = await prisma.campaignSession.findFirst({
    where: { id: sessionId, userId: auth.id },
    select: { id: true },
  })
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const executions = await prisma.ruleExecution.findMany({
    where: { campaignSessionId: sessionId },
    orderBy: { evaluatedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      evaluatedAt: true,
      matched: true,
      reasonText: true,
      actionCreatedId: true,
      rule: {
        select: { name: true },
      },
    },
  })

  return NextResponse.json({
    executions: executions.map(e => ({
      id: e.id,
      evaluatedAt: e.evaluatedAt.toISOString(),
      matched: e.matched,
      reasonText: e.reasonText,
      actionCreatedId: e.actionCreatedId,
      ruleName: e.rule.name,
    })),
  })
}
