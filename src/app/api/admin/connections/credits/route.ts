import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/admin/connections/credits — user credit balance + recent usage
export async function GET(req: NextRequest) {
  const user = await requireAuth(req)
  if (user instanceof NextResponse) return user

  const userData = await prisma.adminUser.findUnique({
    where: { id: user.id },
    select: { creditBalance: true },
  })

  const recentTx = await prisma.creditTransaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      amount: true,
      reason: true,
      refType: true,
      createdAt: true,
      balanceAfter: true,
      txHash: true,
    },
  })

  return NextResponse.json({
    creditBalance: userData?.creditBalance ?? 0,
    recentTransactions: recentTx,
  })
}
