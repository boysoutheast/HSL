import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { id } = params

  let body: { status?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.status || !['active', 'rejected'].includes(body.status)) {
    return NextResponse.json(
      { error: 'Status harus "active" atau "rejected"' },
      { status: 400 },
    )
  }

  const user = await prisma.adminUser.findUnique({ where: { id } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Cannot change admin's own status
  if (id === auth.id) {
    return NextResponse.json(
      { error: 'Tidak bisa mengubah status diri sendiri' },
      { status: 403 },
    )
  }

  const updated = await prisma.adminUser.update({
    where: { id },
    data: { status: body.status },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
    },
  })

  return NextResponse.json({ user: updated })
}
