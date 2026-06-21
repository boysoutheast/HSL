import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * PATCH /api/admin/campaign-sessions/[id]/creative-pool/[poolId]
 * Edit copy / reorder / archive. 409 if status='used' (immutable).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; poolId: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const existing = await prisma.campaignCreativePool.findFirst({
    where: { id: params.poolId, campaignSessionId: params.id, userId: auth.id },
  })
  if (!existing) return NextResponse.json({ error: 'Creative not found' }, { status: 404 })

  if (existing.status === 'used') {
    return NextResponse.json({ error: 'Used creative is immutable' }, { status: 409 })
  }

  let body: {
    primaryText?: string
    headline?: string
    description?: string
    callToAction?: string
    linkUrl?: string
    mediaAssetId?: string
    creativeUrl?: string
    format?: string
    sortOrder?: number
    status?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {}
  if (body.primaryText !== undefined) updateData.primaryText = body.primaryText.slice(0, 2000)
  if (body.headline !== undefined) updateData.headline = body.headline
  if (body.description !== undefined) updateData.description = body.description
  if (body.callToAction !== undefined) updateData.callToAction = body.callToAction
  if (body.linkUrl !== undefined) updateData.linkUrl = body.linkUrl
  if (body.mediaAssetId !== undefined) updateData.mediaAssetId = body.mediaAssetId
  if (body.creativeUrl !== undefined) updateData.creativeUrl = body.creativeUrl
  if (body.format !== undefined) updateData.format = body.format
  if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder
  if (body.status !== undefined && ['available', 'archived'].includes(body.status)) {
    updateData.status = body.status
  }

  const item = await prisma.campaignCreativePool.update({
    where: { id: params.poolId },
    data: updateData,
  })

  return NextResponse.json({ item })
}

/**
 * DELETE /api/admin/campaign-sessions/[id]/creative-pool/[poolId]
 * Soft delete (archived) if used; hard delete if available.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; poolId: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const existing = await prisma.campaignCreativePool.findFirst({
    where: { id: params.poolId, campaignSessionId: params.id, ...(auth.role === 'admin' ? {} : { userId: auth.id }) },
  })
  if (!existing) return NextResponse.json({ error: 'Creative not found' }, { status: 404 })

  if (existing.status === 'used') {
    await prisma.campaignCreativePool.update({
      where: { id: params.poolId },
      data: { status: 'archived' },
    })
  } else {
    await prisma.campaignCreativePool.delete({ where: { id: params.poolId } })
  }

  return NextResponse.json({ success: true })
}
