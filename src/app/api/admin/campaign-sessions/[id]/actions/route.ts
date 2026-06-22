import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { createCampaign, createAd, resolvePageId, setStatus, updateBudget, TokenError, RateLimitError } from '@/lib/meta-client'
import { canWriteToAdAccount, markAccountHealthy, markAccountNeedsReconnect } from '@/lib/write-guard'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/admin/campaign-sessions/[id]/actions
 * List AutomationActions for a specific campaign session, sorted by requestedAt desc.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const sessionId = params.id

  // Verify the session belongs to the user
  const session = await prisma.campaignSession.findFirst({
    where: { id: sessionId, userId: auth.id },
    select: { id: true },
  })

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const actions = await prisma.automationAction.findMany({
    where: { campaignSessionId: sessionId },
    orderBy: { requestedAt: 'desc' },
  })

  return NextResponse.json({ actions })
}

/**
 * POST /api/admin/campaign-sessions/[id]/actions
 * Create AutomationAction + execute langsung via Meta API (SaaS, no worker).
 * Body: { actionType, payload?, priority? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const sessionId = params.id

  let body: {
    actionType: string
    payload?: Record<string, unknown>
    priority?: number
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.actionType) {
    return NextResponse.json({ error: 'actionType is required' }, { status: 400 })
  }

  // Verify the session belongs to the user and get context
  const session = await prisma.campaignSession.findFirst({
    where: { id: sessionId, userId: auth.id },
    select: {
      id: true,
      userId: true,
      metaAdAccountId: true,
      metaAdAccount: { select: { adAccountId: true } },
    },
  })

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const priority = body.priority ?? 5

  // Idempotency key
  const idempotencyKey = `${auth.id}-${body.actionType}-${sessionId}-${Date.now()}`

  // Create AutomationAction (PENDING)
  const action = await prisma.automationAction.create({
    data: {
      userId: auth.id,
      campaignSessionId: sessionId,
      source: 'USER',
      actionType: body.actionType,
      payloadJson: JSON.stringify(body.payload ?? {}),
      status: 'PENDING',
      idempotencyKey,
      priority,
      requestedAt: new Date(),
    },
  })

  // ── Eksekusi langsung berdasarkan actionType ──────────
  const payload = body.payload ?? {}
  let actionStatus = 'SUCCEEDED'
  let metaResponseJson: string | null = null
  let targetMetaEntityId: string | null = null
  let errorMessage: string | null = null

  try {
    const actionType = body.actionType

    // NOTIFY — no Meta write, just mark succeeded
    if (actionType === 'NOTIFY') {
      // Notifications don't need Meta API — already handled
      actionStatus = 'SUCCEEDED'
    }
    else if (['PAUSE_CAMPAIGN', 'PAUSE_ADSET', 'RESUME_CAMPAIGN', 'RESUME_ADSET'].includes(actionType)) {
      // setStatus requires token + entityId
      const entityId = String(payload.campaignId ?? payload.adsetId ?? '')
      if (!entityId) throw new Error('entityId (campaignId/adsetId) required in payload')
      const metaStatus = actionType.startsWith('PAUSE') ? 'PAUSED' : 'ACTIVE'

      const writeCheck = await canWriteToAdAccount(auth.id, session.metaAdAccountId)
      if (!writeCheck.ok) throw new Error(writeCheck.reason ?? 'Write access denied')
      const token = writeCheck.token!
      await markAccountHealthy(session.metaAdAccountId!)

      await setStatus(entityId, metaStatus, token)
      metaResponseJson = JSON.stringify({ entityId, status: metaStatus })
      targetMetaEntityId = entityId
    }
    else if (actionType === 'UPDATE_BUDGET') {
      const entityId = String(payload.campaignId ?? payload.adsetId ?? '')
      const minor = Number(payload.dailyBudgetMinor ?? payload.dailyBudget ?? 0)
      if (!entityId) throw new Error('campaignId/adsetId required in payload')

      const writeCheck = await canWriteToAdAccount(auth.id, session.metaAdAccountId)
      if (!writeCheck.ok) throw new Error(writeCheck.reason ?? 'Write access denied')
      const token = writeCheck.token!
      await markAccountHealthy(session.metaAdAccountId!)

      const level = body.actionType === 'UPDATE_BUDGET' && payload.level === 'ADSET' ? 'ADSET' as const : 'CAMPAIGN' as const
      await updateBudget(entityId, minor, token, level)
      metaResponseJson = JSON.stringify({ entityId, dailyBudgetMinor: minor, level })
      targetMetaEntityId = entityId
    }
    else if (actionType === 'CREATE_CAMPAIGN') {
      const adAccountIdNumeric = session.metaAdAccount?.adAccountId?.replace(/^act_/, '')
      if (!adAccountIdNumeric) throw new Error('No ad account linked')
      if (!session.metaAdAccountId) throw new Error('No meta ad account')

      const writeCheck = await canWriteToAdAccount(auth.id, session.metaAdAccountId)
      if (!writeCheck.ok) throw new Error(writeCheck.reason ?? 'Write access denied')
      const token = writeCheck.token!
      await markAccountHealthy(session.metaAdAccountId)

      const result = await createCampaign(adAccountIdNumeric, {
        name: String(payload.name ?? 'Campaign'),
        objective: String(payload.objective ?? 'OUTCOME_LEADS'),
        status: 'PAUSED',
        specialAdCategories: [],
      }, token)
      metaResponseJson = JSON.stringify(result)
      targetMetaEntityId = result.id
    }
    else if (['CREATE_AD', 'REPLACE_AD', 'ADD_CREATIVE'].includes(actionType)) {
      const adAccountIdNumeric = session.metaAdAccount?.adAccountId?.replace(/^act_/, '')
      if (!adAccountIdNumeric) throw new Error('No ad account linked')
      if (!session.metaAdAccountId) throw new Error('No meta ad account')

      const writeCheck = await canWriteToAdAccount(auth.id, session.metaAdAccountId)
      if (!writeCheck.ok) throw new Error(writeCheck.reason ?? 'Write access denied')
      const token = writeCheck.token!
      await markAccountHealthy(session.metaAdAccountId)

      const pageId = String(payload.pageId ?? '')
      const resolvedPageId = pageId || await resolvePageId(adAccountIdNumeric, token, {
        sessionId,
        metaAdAccountId: session.metaAdAccountId!,
      })
      const adsetId = String(payload.adsetId ?? '')
      if (!adsetId) throw new Error('adsetId required in payload')

      const result = await createAd({
        adAccountId: adAccountIdNumeric,
        pageId: resolvedPageId,
        adsetId,
        name: String(payload.name ?? `Ad-${Date.now()}`),
        primaryText: String(payload.primaryText ?? payload.message ?? ''),
        headline: String(payload.headline ?? ''),
        description: String(payload.description ?? ''),
        callToAction: String(payload.callToAction ?? 'LEARN_MORE'),
        linkUrl: String(payload.linkUrl ?? ''),
        mediaUrl: payload.mediaUrl ? String(payload.mediaUrl) : null,
        status: 'PAUSED',
      }, token)

      metaResponseJson = JSON.stringify(result)
      targetMetaEntityId = result.adId
    }
    else {
      // Unsupported actionType
      actionStatus = 'FAILED'
      errorMessage = `unsupported actionType: ${actionType}`
    }
  } catch (err: any) {
    actionStatus = 'FAILED'
    errorMessage = err instanceof TokenError
      ? 'Token error — reconnect needed'
      : err instanceof RateLimitError
        ? 'Meta rate limited — try later'
        : err?.message ?? 'Unknown error'

    if (err instanceof TokenError && session.metaAdAccountId) {
      await markAccountNeedsReconnect(session.metaAdAccountId)
    }
  }

  // Update AutomationAction with result
  const updatedAction = await prisma.automationAction.update({
    where: { id: action.id },
    data: {
      status: actionStatus,
      executedAt: new Date(),
      ...(metaResponseJson ? { metaResponseJson } : {}),
      ...(targetMetaEntityId ? { targetMetaEntityId } : {}),
      ...(errorMessage ? { errorMessage } : {}),
    },
  })

  // If CREATE_CAMPAIGN succeeded, save metaCampaignId to session
  if (body.actionType === 'CREATE_CAMPAIGN' && actionStatus === 'SUCCEEDED' && targetMetaEntityId) {
    await prisma.campaignSession.update({
      where: { id: sessionId },
      data: { metaCampaignId: targetMetaEntityId },
    })
  }

  return NextResponse.json(
    {
      action: {
        id: updatedAction.id,
        actionType: updatedAction.actionType,
        status: updatedAction.status,
        metaResponseJson: updatedAction.metaResponseJson,
        targetMetaEntityId: updatedAction.targetMetaEntityId,
        errorMessage: updatedAction.errorMessage,
      },
    },
    { status: actionStatus === 'FAILED' ? 500 : 201 }
  )
}
