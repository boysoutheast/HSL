import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateApiKey, unauthorizedResponse } from '../../../_lib/api-key-auth'

export const runtime = 'nodejs'

/**
 * PATCH /api/internal/campaign-sessions/topup-log/[id]
 * Worker updates top-up log after ad creation.
 * Body: { status: 'succeeded'|'failed', usedMetaAdId?, failedReason? }
 * If failed → pool creative goes back to 'available' or 'failed' based on error.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!validateApiKey(req)) return unauthorizedResponse()

  let body: {
    status: string
    usedMetaAdId?: string
    failedReason?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.status || !['succeeded', 'failed'].includes(body.status)) {
    return NextResponse.json({ error: 'status must be succeeded or failed' }, { status: 400 })
  }

  const log = await prisma.campaignTopupLog.findUnique({
    where: { id: params.id },
    select: { id: true, poolCreativeId: true, status: true },
  })
  if (!log) return NextResponse.json({ error: 'Topup log not found' }, { status: 404 })
  if (log.status !== 'pending') {
    return NextResponse.json({ error: 'Topup log already resolved' }, { status: 409 })
  }

  // Update log
  const updateData: Record<string, unknown> = {
    status: body.status,
  }
  if (body.usedMetaAdId) updateData.usedMetaAdId = body.usedMetaAdId
  if (body.failedReason) updateData.note = body.failedReason

  await prisma.campaignTopupLog.update({
    where: { id: params.id },
    data: updateData,
  })

  // Update pool creative status
  if (log.poolCreativeId) {
    if (body.status === 'succeeded') {
      await prisma.campaignCreativePool.update({
        where: { id: log.poolCreativeId },
        data: { usedMetaAdId: body.usedMetaAdId ?? null },
      })
    } else {
      // Failed — retryable or permanent based on error
      const isPermanent = !!(body.failedReason?.includes('CREATIVE_DISABLED') ||
                          body.failedReason?.includes('DISAPPROVED') ||
                          body.failedReason?.includes('POLICY'))
      await prisma.campaignCreativePool.update({
        where: { id: log.poolCreativeId },
        data: {
          status: isPermanent ? 'failed' : 'available',
          failedReason: body.failedReason ?? null,
        },
      })
    }
  }

  return NextResponse.json({ success: true })
}
