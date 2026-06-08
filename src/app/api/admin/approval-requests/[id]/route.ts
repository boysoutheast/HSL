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
    // Update testLaunch status
    await prisma.testLaunch.update({
      where: { id: approvalRequest.testLaunchId },
      data: { status: 'approved' },
    })

    // Create WorkerTask with type='create_campaign'
    const payload = {
      testLaunchId: approvalRequest.testLaunch.id,
      metaAccountId: approvalRequest.testLaunch.metaAccountId,
      productId: approvalRequest.testLaunch.productId,
      objective: approvalRequest.testLaunch.objective,
      dailyBudget: approvalRequest.testLaunch.dailyBudget.toString(),
      targetingJson: approvalRequest.testLaunch.targetingJson,
      launchMode: approvalRequest.testLaunch.launchMode,
      sourceAdsetId: approvalRequest.testLaunch.sourceAdsetId,
      notes: approvalRequest.testLaunch.notes,
      creatives: approvalRequest.testLaunch.creatives.map((c) => ({
        id: c.id,
        creativeUrl: c.creativeUrl,
        captionText: c.captionText,
        hookText: c.hookText,
        headline: c.headline,
        callToAction: c.callToAction,
      })),
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
