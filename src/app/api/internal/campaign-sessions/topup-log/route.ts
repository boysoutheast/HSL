import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateApiKey, unauthorizedResponse } from '../../_lib/api-key-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/internal/campaign-sessions/topup-log?automationActionId=<id>
 * Worker maps a CREATE_AD action back to its CampaignTopupLog to report result.
 */
export async function GET(req: NextRequest) {
  if (!validateApiKey(req)) return unauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const automationActionId = searchParams.get('automationActionId')

  if (!automationActionId) {
    return NextResponse.json({ error: 'automationActionId query param is required' }, { status: 400 })
  }

  const log = await prisma.campaignTopupLog.findFirst({
    where: { automationActionId },
    orderBy: { triggeredAt: 'desc' },
    select: { id: true, status: true, poolCreativeId: true, campaignSessionId: true },
  })

  if (!log) {
    return NextResponse.json({ error: 'Topup log not found' }, { status: 404 })
  }

  return NextResponse.json({ log })
}
