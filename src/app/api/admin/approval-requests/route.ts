import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  const skip = (page - 1) * limit
  const statusFilter = searchParams.get('status')
  const where = statusFilter && ['pending', 'approved', 'rejected'].includes(statusFilter)
    ? { status: statusFilter }
    : {}

  const [requests, total] = await Promise.all([
    prisma.approvalRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        testLaunch: {
          select: {
            id: true,
            name: true,
            status: true,
            objective: true,
            dailyBudget: true,
            launchMode: true,
            metaAccountId: true,
            productId: true,
          },
        },
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
        reviewedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    prisma.approvalRequest.count({ where }),
  ])

  return NextResponse.json({
    requests,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  })
}
