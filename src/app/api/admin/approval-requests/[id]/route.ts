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

    // Build complete immutable payload snapshot
    const payload = {
      launchId: testLaunch.id,
      userId: testLaunch.userId,
      metaAccountId: testLaunch.metaAccountId,
      adAccountId: testLaunch.metaAccount?.defaultAdAccountId ? `act_${testLaunch.metaAccount.defaultAdAccountId}` : '',
      pageId: testLaunch.pageId || '',
      igAccountId: testLaunch.igAccountId || '',
      objective: testLaunch.objective || 'OUTCOME_LEADS',
      dailyBudget: Number(testLaunch.dailyBudget),
      currency: testLaunch.metaAccount?.currency || 'IDR',
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
      launchMode: testLaunch.launchMode || 'new_test',
      snapshotAt: now.toISOString(),
    }

    await prisma.workerTask.create({
      data: {
        type: 'create_campaign',
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
