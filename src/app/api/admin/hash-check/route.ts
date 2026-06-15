import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (admin instanceof NextResponse) return admin

  let body: { hash?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { hash } = body
  if (!hash || typeof hash !== 'string' || hash.length !== 64) {
    return NextResponse.json({ error: 'Invalid hash — must be 64-char hex string' }, { status: 400 })
  }

  // Cari di CreditTransaction
  const tx = await prisma.creditTransaction.findUnique({
    where: { txHash: hash },
    select: {
      id: true, userId: true, amount: true, reason: true,
      balanceAfter: true, createdAt: true, refId: true, refType: true,
      idempotencyKey: true,
      user: { select: { email: true, name: true } },
    },
  })
  if (tx) {
    return NextResponse.json({ found: true, type: 'tx', record: tx, revoked: false })
  }

  // Cari di GeneratedMedia
  const media = await prisma.generatedMedia.findUnique({
    where: { mediaHash: hash },
    select: {
      id: true, userId: true, status: true, prompt: true,
      creditsCost: true, videoUrl: true, completedAt: true,
      mediaHashRevokedAt: true,
      user: { select: { email: true, name: true } },
    },
  })
  if (media) {
    return NextResponse.json({
      found: true,
      type: 'media',
      record: media,
      revoked: !!media.mediaHashRevokedAt,
    })
  }

  return NextResponse.json({ found: false })
}
