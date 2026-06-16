import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { accountId: string } },
) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  let body: {
    status?: string
    reason?: string
    lockedUntil?: string | null
    assignedHermesId?: string | null
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const account = await prisma.instagramAccount.findUnique({
    where: { id: params.accountId },
  })

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  const monitor = await prisma.postingMonitor.upsert({
    where: { instagramAccountId: params.accountId },
    create: {
      instagramAccountId: params.accountId,
      status: body.status ?? 'READY_UPLOAD',
      reason: body.reason ?? 'Manual override by admin',
      lockedUntil: body.lockedUntil ? new Date(body.lockedUntil) : null,
      assignedHermesId: body.assignedHermesId,
    },
    update: {
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.reason !== undefined ? { reason: body.reason } : {}),
      ...(body.lockedUntil !== undefined
        ? { lockedUntil: body.lockedUntil ? new Date(body.lockedUntil) : null }
        : {}),
      ...(body.assignedHermesId !== undefined
        ? { assignedHermesId: body.assignedHermesId }
        : {}),
    },
  })

  return NextResponse.json({ monitor })
}
