import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const session = await prisma.campaignSession.findFirst({
    where: { id: params.id, userId: auth.id },
    select: { id: true, importStatus: true },
  })

  if (!session) {
    return NextResponse.json({ error: 'Campaign session not found' }, { status: 404 })
  }

  // Reset state: cron akan pick up 'pending_sync' di siklus berikutnya (~5 menit)
  await prisma.campaignSession.update({
    where: { id: params.id },
    data: { importStatus: 'pending_sync', importError: null },
  })

  return NextResponse.json({ ok: true })
}
