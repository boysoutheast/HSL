import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    status?: 'approved' | 'rejected'
    reviewNote?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.status || !['approved', 'rejected'].includes(body.status)) {
    return NextResponse.json({ error: 'status must be "approved" or "rejected"' }, { status: 400 })
  }

  const approvalRequest = await prisma.approvalRequest.findUnique({
    where: { id: params.id },
    include: {
      testLaunch: {
        include: {
          creatives: true,
          metaAccount: true,
        },
      },
    },
  })

  if (!approvalRequest) {
    return NextResponse.json({ error: 'ApprovalRequest not found' }, { status: 404 })
  }

  if (approvalRequest.status !== 'pending') {
    return NextResponse.json({ error: 'ApprovalRequest is not pending' }, { status: 409 })
  }

  const now = new Date()

  if (body.status === 'approved') {
    // Load full TestLaunch with all fields + metaAccount (safe fields only, no encrypted tokens)
    const testLaunch = await prisma.testLaunch.findUnique({
      where: { id: approvalRequest.testLaunchId },
      include: {
        creatives: true,
        metaAccount: {
          select: {
            id: true,
            defaultAdAccountId: true,
            accountName: true,
            currency: true,
            timezone: true,
            userId: true,
          },
        },
      },
    })

    if (!testLaunch) {
      return NextResponse.json({ error: 'TestLaunch not found' }, { status: 404 })
    }

    // Update testLaunch status
    await prisma.testLaunch.update({
      where: { id: approvalRequest.testLaunchId },
      data: { status: 'approved' },
    })

    // Parse audience from targetingJson
    let audience = { ageMin: 25, ageMax: 45, gender: 'all', locations: [{ type: 'country', key: 'ID' }] }
    if (testLaunch.targetingJson) {
      try {
        const targeting = typeof testLaunch.targetingJson === 'string'
          ? JSON.parse(testLaunch.targetingJson)
          : testLaunch.targetingJson
        if (targeting.audience) {
          audience = targeting.audience
        }
      } catch {
        // Use default audience
      }
    }

    // Parse placements from placementsJson
    let placements: string[] = []
    if (testLaunch.placementsJson) {
      try {
        placements = JSON.parse(testLaunch.placementsJson)
      } catch {
        // Use empty
      }
    }

    // Resolve actual Meta ad account ID (not HSL DB id). TestLaunch.metaAdAccountId stores MetaAdAccount.id.
    const selectedAdAccount = testLaunch.metaAdAccountId
      ? await prisma.metaAdAccount.findUnique({
          where: { id: testLaunch.metaAdAccountId },
          select: { adAccountId: true, adAccountName: true },
        })
      : null

    const adAccountId = selectedAdAccount?.adAccountId
      || testLaunch.metaAccount?.defaultAdAccountId
      || ''

    // Build complete immutable payload snapshot for full launch
    const payload = {
      metaConnectionId: testLaunch.metaAccountId,
      adAccountId,
      pageId: testLaunch.pageId || '',
      igAccountId: testLaunch.igAccountId || '',
      objective: testLaunch.objective || 'OUTCOME_LEADS',
      dailyBudget: Number(testLaunch.dailyBudget),
      destinationUrl: testLaunch.destinationUrl || '',
      placementMode: testLaunch.placementMode || 'automatic',
      placements,
      audience,
      creatives: testLaunch.creatives.map((c) => ({
        imageUrl: c.creativeUrl || '',
        primaryText: c.primaryText || c.hookText || c.captionText || '',
        headline: c.adHeadline || c.headline || '',
        callToAction: c.callToAction || 'LEARN_MORE',
      })),
      name: testLaunch.name || `HSL Launch ${now.toISOString()}`,
      pixelId: testLaunch.pixelId || '',
      snapshotAt: now.toISOString(),
    }

    // Determine task type based on launch mode and creatives
    const hasCreatives = testLaunch.creatives && testLaunch.creatives.length > 0
    const taskType = hasCreatives ? 'create_full_launch' : 'create_campaign'

    await prisma.workerTask.create({
      data: {
        type: taskType,
        payloadJson: JSON.stringify(payload),
        status: 'pending',
        priority: 1,
        testLaunchId: approvalRequest.testLaunchId,
      },
    })
  } else {
    // Rejected — update testLaunch status
    await prisma.testLaunch.update({
      where: { id: approvalRequest.testLaunchId },
      data: { status: 'rejected' },
    })
  }

  const updated = await prisma.approvalRequest.update({
    where: { id: params.id },
    data: {
      status: body.status,
      reviewedById: auth.id,
      reviewedAt: now,
      reviewNote: body.reviewNote ?? null,
    },
    include: {
      testLaunch: true,
      requestedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json({ approvalRequest: updated })
}
