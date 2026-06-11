import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { encode } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

async function findOwned(id: string, auth: { id: string; role: string }) {
  return prisma.capiEventConfig.findFirst({
    where: { id, ...(auth.role === 'admin' ? {} : { userId: auth.id }) },
  })
}

// PATCH /api/admin/capi-configs/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const config = await findOwned(params.id, auth)
  if (!config) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const updated = await prisma.capiEventConfig.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.pixelId !== undefined ? { pixelId: body.pixelId.trim() } : {}),
      ...(body.accessToken ? { accessTokenEncrypted: encode(body.accessToken.trim()) } : {}),
      ...(body.testEventCode !== undefined ? { testEventCode: body.testEventCode?.trim() || null } : {}),
      ...(Array.isArray(body.allowedEvents) ? { allowedEvents: body.allowedEvents } : {}),
      ...(body.landingPageId !== undefined ? { landingPageId: body.landingPageId } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
  })

  return NextResponse.json({ config: { ...updated, accessTokenEncrypted: undefined } })
}

// DELETE /api/admin/capi-configs/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const config = await findOwned(params.id, auth)
  if (!config) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.capiEventConfig.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
