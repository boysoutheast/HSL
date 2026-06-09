import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const existing = await prisma.metaSchedule.findUnique({ where: { id: params.id } })
  if (!existing) {
    return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
  }

  const schedule = await prisma.metaSchedule.update({
    where: { id: params.id },
    data: {
      status: 'pending',
      attempts: existing.attempts + 1,
      lastError: null,
    },
    include: {
      metaPage: { select: { id: true, pageId: true, pageName: true } },
      metaPost: { select: { id: true, title: true, message: true, status: true } },
    },
  })

  return NextResponse.json({ schedule })
}
