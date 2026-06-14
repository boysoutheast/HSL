import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { AutomationAction, WorkerTask } from '@prisma/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const phase = searchParams.get('phase')

  const where: Record<string, unknown> = { userId: auth.id }
  if (status) where.status = status
  if (phase) where.phase = phase

  const sessions = await prisma.campaignSession.findMany({
    where,
    include: {
      metaAdAccount: { select: { id: true, adAccountId: true, adAccountName: true } },
      _count: { select: { automationRules: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const sessionsWithMetrics = await Promise.all(
    sessions.map(async (session) => {
      const latest = await prisma.metricSnapshot.findFirst({
        where: { campaignSessionId: session.id },
        orderBy: { windowEnd: 'desc' },
      })
      return { ...session, latestMetric: latest }
    })
  )

  return NextResponse.json({ sessions: sessionsWithMetrics })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    testLaunchId?: string
    productId?: string
    metaAdAccountId?: string
    name?: string
    objective?: string
    dailyBudget?: number
    phase?: string
    automationEnabled?: boolean
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.name || !body.productId) {
    return NextResponse.json({ error: 'name and productId are required' }, { status: 400 })
  }

  const session = await prisma.campaignSession.create({
    data: {
      userId: auth.id,
      testLaunchId: body.testLaunchId,
      productId: body.productId,
      metaAdAccountId: body.metaAdAccountId,
      name: body.name,
      objective: body.objective ?? 'OUTCOME_LEADS',
      dailyBudget: body.dailyBudget ?? 0,
      phase: body.phase ?? 'TESTING',
      automationEnabled: body.automationEnabled ?? true,
      status: 'DRAFT',
    },
  })

  // Create AutomationAction for campaign creation (P1_INTERACTIVE = priority 1)
  const createCampaignAction = await prisma.automationAction.create({
    data: {
      userId: auth.id,
      campaignSessionId: session.id,
      source: 'USER',
      actionType: 'CREATE_CAMPAIGN',
      payloadJson: JSON.stringify({ campaignSessionId: session.id, name: session.name }),
      status: 'PENDING',
      idempotencyKey: `${auth.id}-CREATE_CAMPAIGN-${session.id}-${Date.now()}`,
      priority: 1, // P1_INTERACTIVE
      requestedAt: new Date(),
    },
  })

  // Create paired WorkerTask for the automation action
  await prisma.workerTask.create({
    data: {
      type: 'automation_action',
      payloadJson: JSON.stringify({
        actionId: createCampaignAction.id,
        actionType: 'CREATE_CAMPAIGN',
        campaignSessionId: session.id,
        payload: { campaignSessionId: session.id, name: session.name },
      }),
      scope: 'internal',
      status: 'PENDING',
      priority: 1,
      testLaunchId: session.testLaunchId,
    },
  })

  return NextResponse.json({ session }, { status: 201 })
}
