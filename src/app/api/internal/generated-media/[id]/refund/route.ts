import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateApiKey, unauthorizedResponse } from '../../../_lib/api-key-auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/internal/generated-media/[id]/refund
 * Idempotent auto-refund for failed generate jobs.
 * Called by Hermes worker when GENERATE_VIDEO task fails.
 *
 * Rules:
 *  - Only refunds jobs that have a non-zero creditsCost
 *  - Idempotent: checks refundedAt — if already set, returns 200 with status
 *  - Credits back to user balance with positive creditTransaction
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!validateApiKey(req)) {
    return unauthorizedResponse()
  }

  const gm = await prisma.generatedMedia.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      userId: true,
      creditsCost: true,
      refundedAt: true,
      status: true,
    },
  })

  if (!gm) {
    return NextResponse.json({ error: 'GeneratedMedia not found' }, { status: 404 })
  }

  if (gm.refundedAt) {
    return NextResponse.json({ ok: true, action: 'already_refunded', refundedAt: gm.refundedAt })
  }

  if (!gm.userId || !gm.creditsCost || gm.creditsCost <= 0) {
    return NextResponse.json({ ok: true, action: 'skipped', reason: 'no credits to refund' })
  }

  const idempotencyKey = `refund_${gm.id}`

  try {
    await prisma.$transaction(async (tx) => {
      // Double-check still not refunded
      const current = await tx.generatedMedia.findUnique({
        where: { id: gm.id },
        select: { refundedAt: true },
      })
      if (current?.refundedAt) {
        return // already refunded in race
      }

      const updatedUser = await tx.adminUser.update({
        where: { id: gm.userId! },
        data: { creditBalance: { increment: gm.creditsCost! } },
        select: { creditBalance: true },
      })

      await tx.creditTransaction.create({
        data: {
          userId: gm.userId!,
          amount: gm.creditsCost!, // positive = refund
          reason: 'refund',
          refId: gm.id,
          refType: 'generated_media',
          balanceAfter: updatedUser.creditBalance,
          idempotencyKey,
        },
      })

      await tx.generatedMedia.update({
        where: { id: gm.id },
        data: { refundedAt: new Date() },
      })
    })

    return NextResponse.json({ ok: true, action: 'refunded', creditsRefunded: gm.creditsCost })
  } catch (err: any) {
    // Idempotency key collision = already processed
    if (err?.code === 'P2002' || (err?.message && err.message.includes('Unique constraint'))) {
      return NextResponse.json({ ok: true, action: 'already_refunded', via: 'idempotency_key' })
    }
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
