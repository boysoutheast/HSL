import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const [pendingApprovals, pendingActions, readyUpload] = await Promise.all([
      prisma.approvalRequest.count({ where: { status: 'pending' } }),
      prisma.automationAction.count({ where: { status: 'PENDING' } }),
      prisma.postingMonitor.count({ where: { status: 'READY_UPLOAD' } }),
    ])

    return NextResponse.json({
      ads: pendingActions,
      approvals: pendingApprovals,
      influencer: readyUpload,
    })
  } catch (e) {
    console.error('nav-badges error:', e)
    return NextResponse.json({ ads: 0, influencer: 0 })
  }
}
