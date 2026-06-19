import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateApiKey, unauthorizedResponse } from '../../../_lib/api-key-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PATCH /api/internal/campaign-sessions/[id]/sync-status
 * Worker reports sync result after pulling Meta campaign structure.
 * Body: { importStatus: 'synced'|'sync_failed'|'pending_sync', dailyBudget? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!validateApiKey(req)) return unauthorizedResponse()

  let body: { importStatus?: string; dailyBudget?: number }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const valid = ['synced', 'sync_failed', 'pending_sync']
  if (body.importStatus !== undefined && !valid.includes(body.importStatus)) {
    return NextResponse.json({ error: `importStatus must be one of ${valid.join(', ')}` }, { status: 400 })
  }

  const session = await prisma.campaignSession.findUnique({
    where: { id: params.id },
    select: { id: true },
  })
  if (!session) {
    return NextResponse.json({ error: 'Campaign session not found' }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (body.importStatus !== undefined) data.importStatus = body.importStatus
  if (body.dailyBudget !== undefined) {
    if (typeof body.dailyBudget !== 'number' || body.dailyBudget < 0) {
      return NextResponse.json({ error: 'dailyBudget must be a non-negative number' }, { status: 400 })
    }
    data.dailyBudget = body.dailyBudget
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const updated = await prisma.campaignSession.update({
    where: { id: params.id },
    data,
    select: { id: true, importStatus: true, dailyBudget: true },
  })

  return NextResponse.json({ session: updated })
}
