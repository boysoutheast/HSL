import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashApiKey, requireAuth } from '@/lib/auth'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

// POST /api/admin/hermes-agents/:id/regenerate-key
// Returns the new raw key once — never stored.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const agent = await prisma.hermesAgent.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, ownerUserId: true },
  })

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  // admin can regen any agent; non-admin can only regen their own
  if (auth.role !== 'admin' && agent.ownerUserId !== auth.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rawKey   = randomBytes(32).toString('hex')
  const keyHash  = hashApiKey(rawKey)

  await prisma.hermesAgent.update({
    where: { id: params.id },
    data:  { apiKeyHash: keyHash },
  })

  return NextResponse.json({
    apiKey:  rawKey,
    message: 'API key regenerated. Save this key — it will not be shown again.',
  })
}
