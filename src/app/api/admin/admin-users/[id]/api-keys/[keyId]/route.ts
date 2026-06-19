import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/admin/admin-users/[id]/api-keys/[keyId]
 * Revoke a user's API key. Admin only.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; keyId: string } },
) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const key = await prisma.userApiKey.findFirst({
    where: { id: params.keyId, userId: params.id },
    select: { id: true, prefix: true, status: true },
  })
  if (!key) return NextResponse.json({ error: 'API key not found' }, { status: 404 })
  if (key.status === 'revoked') return NextResponse.json({ error: 'API key already revoked' }, { status: 409 })

  await prisma.userApiKey.update({
    where: { id: params.keyId },
    data: { status: 'revoked' },
  })

  console.log(`[audit] Admin ${auth.id} revoked key ${key.prefix}*** for user ${params.id}`)

  return NextResponse.json({ ok: true, keyId: params.keyId, status: 'revoked' })
}
