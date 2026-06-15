import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiKey } from '@/lib/api-key-auth'

export const dynamic = 'force-dynamic'

// GET /api/gen/credits — check balance
export async function GET(req: NextRequest) {
  const user = await requireApiKey(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized — invalid or missing API key' }, { status: 401 })
  }

  const recentTx = await prisma.creditTransaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      amount: true,
      reason: true,
      refId: true,
      refType: true,
      balanceAfter: true,
      txHash: true,
      createdAt: true,
    },
  })

  return NextResponse.json({
    balance: user.creditBalance,
    transactions: recentTx,
  })
}
