import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const hermesAgentId = searchParams.get('hermesAgentId')
  const instagramAccountId = searchParams.get('instagramAccountId')
  const characterId = searchParams.get('characterId')
  const topicId = searchParams.get('topicId')
  const cepId = searchParams.get('cepId')
  const status = searchParams.get('status')
  const take = Math.min(parseInt(searchParams.get('take') ?? '50'), 200)
  const skip = parseInt(searchParams.get('skip') ?? '0')

  // Non-admin: hanya log dari akun IG miliknya
  const where = {
    ...(auth.role !== 'admin'
      ? { instagramAccount: { createdByUserId: auth.id } }
      : {}),
    ...(hermesAgentId ? { hermesAgentId } : {}),
    ...(instagramAccountId ? { instagramAccountId } : {}),
    ...(characterId ? { characterId } : {}),
    ...(topicId ? { topicId } : {}),
    ...(cepId ? { cepId } : {}),
    ...(status ? { status } : {}),
  }

  const logs = await prisma.generatedContentLog.findMany({
    where,
    include: {
      hermesAgent: { select: { id: true, name: true } },
      instagramAccount: { select: { id: true, username: true } },
      character: { select: { id: true, name: true } },
      topic: { select: { id: true, name: true } },
      cep: { select: { id: true, cepText: true } },
      product: { select: { id: true, name: true } },
      performanceTracker: true,
    },
    orderBy: { createdAt: 'desc' },
    take,
    skip,
  })

  const total = await prisma.generatedContentLog.count({ where })

  return NextResponse.json({ logs, total, take, skip })
}
