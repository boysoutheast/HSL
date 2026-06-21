import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// DELETE /api/admin/connections/api-keys/[id] — revoke a key
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await requireAuth(_req)
  if (user instanceof NextResponse) return user

  const { id } = params

  const key = await prisma.userApiKey.findFirst({
    where: { id, ...(user.role === 'admin' ? {} : { userId: user.id }) },
  })
  if (!key) {
    return NextResponse.json({ error: 'API key not found' }, { status: 404 })
  }

  await prisma.userApiKey.update({
    where: { id },
    data: { status: 'revoked' },
  })

  return NextResponse.json({ ok: true, revoked: id })
}
