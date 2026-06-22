import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { metaPost, TokenError, RateLimitError } from '@/lib/meta-client'
import { canWriteToAdAccount, markAccountHealthy, markAccountNeedsReconnect } from '@/lib/write-guard'

export const dynamic = 'force-dynamic'

async function findOwned(id: string, auth: { id: string; role: string }) {
  return prisma.metaAudience.findFirst({
    where: { id, ...(auth.role === 'admin' ? {} : { userId: auth.id }) },
  })
}

// PATCH /api/admin/meta-audiences/[id] — update metadata / sync status
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const audience = await findOwned(params.id, auth)
  if (!audience) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const updated = await prisma.metaAudience.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.metaAudienceId !== undefined ? { metaAudienceId: body.metaAudienceId } : {}),
      ...(body.sizeLowerBound !== undefined ? { sizeLowerBound: body.sizeLowerBound } : {}),
      ...(body.sizeUpperBound !== undefined ? { sizeUpperBound: body.sizeUpperBound } : {}),
      ...(body.errorMessage !== undefined ? { errorMessage: body.errorMessage } : {}),
      ...(body.status === 'READY' ? { lastSyncedAt: new Date() } : {}),
    },
  })

  return NextResponse.json({ audience: updated })
}

// DELETE /api/admin/meta-audiences/[id] — hapus dari Meta langsung + record lokal
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const audience = await findOwned(params.id, auth)
  if (!audience) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Kalau audience sudah ada di Meta, hapus langsung via API (best-effort)
  if (audience.metaAudienceId && audience.status === 'READY') {
    try {
      const writeCheck = await canWriteToAdAccount(auth.id, audience.metaAdAccountId)
      if (writeCheck.ok && writeCheck.token) {
        await metaPost(`/${audience.metaAudienceId}`, writeCheck.token, {})
        await markAccountHealthy(audience.metaAdAccountId)
      }
    } catch (err: any) {
      // Gagal di Meta (mis. udah kehapus) → log + lanjut hapus row lokal
      console.warn(`[meta-audiences/delete] Meta delete failed (best-effort): ${err?.message}`)
      if (err instanceof TokenError) {
        await markAccountNeedsReconnect(audience.metaAdAccountId)
      }
    }
  }

  await prisma.metaAudience.update({
    where: { id: params.id },
    data: { status: 'DELETED' },
  })

  return NextResponse.json({ success: true })
}
