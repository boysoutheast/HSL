import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const testLaunch = await prisma.testLaunch.findFirst({
    where: {
      id: params.id,
      ...(auth.role === 'admin' ? {} : { userId: auth.id }),
    },
    select: {
      id: true,
      status: true,
      launchMode: true,
      approvalRequest: {
        select: {
          id: true,
          actionType: true,
          status: true,
          requestNote: true,
          reviewNote: true,
          createdAt: true,
          reviewedAt: true,
          requestedBy: { select: { id: true, name: true, email: true } },
          reviewedBy: { select: { id: true, name: true, email: true } },
        },
      },
    },
  })

  if (!testLaunch) {
    return NextResponse.json({ error: 'TestLaunch not found' }, { status: 404 })
  }

  return NextResponse.json({ testLaunch })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  // Fetch existing to check ownership and status
  const existing = await prisma.testLaunch.findUnique({
    where: { id: params.id },
    select: { userId: true, status: true, launchMode: true },
  })

  if (!existing) {
    return NextResponse.json({ error: 'TestLaunch not found' }, { status: 404 })
  }

  // Ownership check
  if (existing.userId !== auth.id && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Only allow submission if status is 'draft'
  if (existing.status !== 'draft') {
    return NextResponse.json({ error: 'Can only submit drafts for approval' }, { status: 400 })
  }

  // Determine actionType based on launchMode
  let actionType: string
  switch (existing.launchMode) {
    case 'new_test':
      actionType = 'create_campaign'
      break
    case 'duplicate_winner':
      actionType = 'duplicate_adset'
      break
    default:
      actionType = 'create_campaign'
  }

  // Update status and create approval request in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.testLaunch.update({
      where: { id: params.id },
      data: { status: 'pending_approval' },
    })

    const approvalRequest = await tx.approvalRequest.create({
      data: {
        testLaunchId: params.id,
        requestedById: auth.id,
        actionType,
        status: 'pending',
      },
    })

    return { testLaunch: updated, approvalRequest }
  })

  return NextResponse.json({
    testLaunch: result.testLaunch,
    approvalRequest: result.approvalRequest,
  }, { status: 201 })
}
