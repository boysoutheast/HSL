import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const test = await prisma.adTest.findUnique({
    where: { id: params.id },
    include: { variants: true },
  })

  if (!test) {
    return NextResponse.json({ error: 'AdTest not found' }, { status: 404 })
  }
  if (auth.role !== 'admin' && test.userId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (test.status !== 'RUNNING') {
    return NextResponse.json(
      { error: `Cannot declare winner on test with status '${test.status}'` },
      { status: 400 },
    )
  }

  let body: { variantId: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const variantIds = test.variants.map((v) => v.id)
  if (!variantIds.includes(body.variantId)) {
    return NextResponse.json(
      { error: 'variantId does not belong to this test' },
      { status: 400 },
    )
  }

  // 1. Mark winner + killed variants
  await prisma.adTestVariant.update({
    where: { id: body.variantId },
    data: { status: 'winner' },
  })
  await prisma.adTestVariant.updateMany({
    where: { adTestId: params.id, id: { not: body.variantId } },
    data: { status: 'killed' },
  })

  // 2. Update test status
  await prisma.adTest.update({
    where: { id: params.id },
    data: {
      status: 'WINNER_DECLARED',
      winnerVariantId: body.variantId,
      endedAt: new Date(),
    },
  })

  // 3. If winner has cepId → append to Cep.notes
  const winnerVariant = test.variants.find((v) => v.id === body.variantId)
  if (winnerVariant?.cepId) {
    const existing = await prisma.cep.findUnique({
      where: { id: winnerVariant.cepId },
      select: { notes: true },
    })
    const tag = `[Test Winner: ${test.name}] ${winnerVariant.name}`
    await prisma.cep.update({
      where: { id: winnerVariant.cepId },
      data: { notes: existing?.notes ? `${existing.notes}\n${tag}` : tag },
    })
  }

  // 4. If winner has testLaunchCreativeId → mark as winner
  if (winnerVariant?.testLaunchCreativeId) {
    await prisma.testLaunchCreative.update({
      where: { id: winnerVariant.testLaunchCreativeId },
      data: { status: 'winner' },
    })
  }

  // 5. Auto-scale: create AutomationActions if autoScaleWinner is true
  if (test.autoScaleWinner && winnerVariant && (winnerVariant.metaAdId || test.campaignSessionId)) {
    const actions: Array<{
      userId: string
      campaignSessionId: string
      source: string
      actionType: string
      targetEntityType: string
      targetMetaEntityId: string
      payloadJson: string
      status: string
      priority: number
      requestedAt: Date
      idempotencyKey: string
    }> = []

    // NOTE: budget lives at adset/campaign level (not ad), and there is no
    // PAUSE_AD action type — so we surface recommendations to the decision
    // queue (NOTIFY) for human approval rather than emitting actions the
    // executor would mis-target. Deterministic idempotencyKey prevents dupes
    // on re-declare/retry (guarded by @@unique([idempotencyKey])).

    // Recommend scaling the winner
    if (winnerVariant.metaAdId) {
      actions.push({
        userId: test.userId,
        campaignSessionId: test.campaignSessionId ?? 'unknown',
        source: 'SYSTEM',
        actionType: 'NOTIFY',
        targetEntityType: 'AD',
        targetMetaEntityId: winnerVariant.metaAdId,
        payloadJson: JSON.stringify({
          recommendation: 'SCALE_WINNER',
          budgetIncreasePct: 30,
          metaAdId: winnerVariant.metaAdId,
          reason: `Test winner: ${test.name} (${winnerVariant.label}:${winnerVariant.name})`,
        }),
        status: 'PENDING',
        priority: 50,
        requestedAt: new Date(),
        idempotencyKey: `test_win_${test.id}_${winnerVariant.id}`,
      })
    }

    // Recommend pausing killed variants
    for (const v of test.variants) {
      if (v.id !== body.variantId && v.metaAdId) {
        actions.push({
          userId: test.userId,
          campaignSessionId: test.campaignSessionId ?? 'unknown',
          source: 'SYSTEM',
          actionType: 'NOTIFY',
          targetEntityType: 'AD',
          targetMetaEntityId: v.metaAdId,
          payloadJson: JSON.stringify({
            recommendation: 'PAUSE_LOSER',
            metaAdId: v.metaAdId,
            reason: `Killed by test: ${test.name} (winner: ${winnerVariant.label})`,
          }),
          status: 'PENDING',
          priority: 50,
          requestedAt: new Date(),
          idempotencyKey: `test_kill_${test.id}_${v.id}`,
        })
      }
    }

    if (actions.length > 0) {
      await prisma.automationAction.createMany({ data: actions })
    }
  }

  // 6. Return the test with autoScaleWinner
  const updated = await prisma.adTest.findUnique({
    where: { id: params.id },
    include: { variants: true },
  })

  return NextResponse.json({
    test: updated,
    autoScaleWinner: updated?.autoScaleWinner ?? false,
  })
}
