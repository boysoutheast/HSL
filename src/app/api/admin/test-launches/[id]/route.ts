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

  const testLaunch = await prisma.testLaunch.findUnique({
    where: { id: params.id },
    include: {
      creatives: true,
      approvalRequest: true,
      metaAccount: {
        select: { accountName: true, adAccountId: true },
      },
      workerTasks: true,
    },
  })

  if (!testLaunch) {
    return NextResponse.json({ error: 'TestLaunch not found' }, { status: 404 })
  }

  return NextResponse.json({ testLaunch })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  // Fetch existing to check ownership
  const existing = await prisma.testLaunch.findUnique({
    where: { id: params.id },
    select: { userId: true, status: true },
  })

  if (!existing) {
    return NextResponse.json({ error: 'TestLaunch not found' }, { status: 404 })
  }

  // Ownership check: userId must match OR auth.role must be admin
  if (existing.userId !== auth.id && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Only allow updates if status is 'draft'
  if (existing.status !== 'draft') {
    return NextResponse.json({ error: 'Can only update drafts' }, { status: 400 })
  }

  let body: {
    metaAccountId?: string
    productId?: string
    name?: string
    objective?: string
    dailyBudget?: number
    targetingJson?: string
    launchMode?: string
    sourceAdsetId?: string
    notes?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const testLaunch = await prisma.testLaunch.update({
    where: { id: params.id },
    data: body,
    include: {
      creatives: true,
      metaAccount: {
        select: { accountName: true, adAccountId: true },
      },
    },
  })

  return NextResponse.json({ testLaunch })
}
