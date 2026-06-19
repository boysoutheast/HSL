import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/admin/campaign-sessions/import
 * Import an existing Meta campaign as a CampaignSession.
 * Body: { metaAdAccountId, metaCampaignId, name, monitorIntervalMinutes?, productId? }
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    metaAdAccountId: string
    metaCampaignId: string
    name: string
    monitorIntervalMinutes?: number
    productId?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.metaAdAccountId || !body.metaCampaignId || !body.name) {
    return NextResponse.json({ error: 'metaAdAccountId, metaCampaignId, and name are required' }, { status: 400 })
  }

  // Verify ad account ownership
  const adAccount = await prisma.metaAdAccount.findFirst({
    where: {
      id: body.metaAdAccountId,
      ...(auth.role === 'admin' ? {} : { metaAccount: { userId: auth.id } }),
    },
    select: { id: true },
  })

  if (!adAccount) {
    return NextResponse.json({ error: 'Ad account not found' }, { status: 404 })
  }

  // Check duplicate — same metaCampaignId per user
  const existing = await prisma.campaignSession.findFirst({
    where: {
      userId: auth.id,
      metaCampaignId: body.metaCampaignId,
    },
    select: { id: true, name: true },
  })

  if (existing) {
    return NextResponse.json({
      error: `Campaign "${existing.name}" is already imported`,
      existingSessionId: existing.id,
    }, { status: 409 })
  }

  // Create CampaignSession
  const session = await prisma.campaignSession.create({
    data: {
      userId: auth.id,
      metaAdAccountId: body.metaAdAccountId,
      metaCampaignId: body.metaCampaignId,
      name: body.name,
      source: 'imported',
      importStatus: 'pending_sync',
      status: 'RUNNING',
      phase: 'TESTING',
      automationEnabled: false,
      dailyBudget: 0, // overwritten after first sync
      monitorIntervalMinutes: body.monitorIntervalMinutes ?? 15,
      productId: body.productId ?? null,
    },
  })

  // Create a WorkerTask for the sync — single source of dispatch
  await prisma.workerTask.create({
    data: {
      type: 'sync_campaign_entities',
      payloadJson: JSON.stringify({
        campaignSessionId: session.id,
        metaCampaignId: body.metaCampaignId,
        metaAdAccountId: body.metaAdAccountId,
      }),
      scope: 'internal',
      status: 'pending',
      priority: 1,
    },
  })

  return NextResponse.json({ session }, { status: 201 })
}
