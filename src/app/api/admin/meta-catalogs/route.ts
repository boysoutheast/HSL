import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { metaPost, TokenError, RateLimitError } from '@/lib/meta-client'
import { decode } from '@/lib/crypto'
import { markAccountNeedsReconnect } from '@/lib/write-guard'

export const dynamic = 'force-dynamic'

// GET /api/admin/meta-catalogs
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const catalogs = await prisma.metaCatalog.findMany({
    where: auth.role === 'admin' ? {} : { userId: auth.id },
    include: { productSets: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ catalogs })
}

// POST /api/admin/meta-catalogs — create catalog langsung di Meta API (SaaS, no worker)
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => null)
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const catalog = await prisma.metaCatalog.create({
    data: {
      userId: auth.id,
      metaBusinessId: body.metaBusinessId ?? null,
      name: body.name.trim(),
      vertical: body.vertical ?? 'commerce',
      isCpas: body.isCpas ?? false,
      partnerName: body.partnerName?.trim() || null,
      status: body.metaBusinessId ? 'CREATING' : 'DRAFT',
    },
  })

  // If metaBusinessId provided, execute directly via Meta API
  if (body.metaBusinessId) {
    try {
      // Get user's MetaAccount token
      const metaAccount = await prisma.metaAccount.findFirst({
        where: { userId: auth.id, status: 'connected' },
        select: { id: true, longLivedTokenEncrypted: true, tokenExpiry: true },
      })
      if (!metaAccount?.longLivedTokenEncrypted) {
        throw new Error('No connected Meta account found')
      }
      if (metaAccount.tokenExpiry && metaAccount.tokenExpiry < new Date()) {
        throw new Error('Meta token expired')
      }
      const token = decode(metaAccount.longLivedTokenEncrypted)

      // POST /{businessId}/owned_product_catalogs
      const { data } = await metaPost(
        `${body.metaBusinessId}/owned_product_catalogs`,
        token,
        {
          name: catalog.name,
          vertical: catalog.vertical || 'commerce',
        },
      )

      const result = data as { id: string }

      // Update catalog record
      await prisma.metaCatalog.update({
        where: { id: catalog.id },
        data: {
          metaCatalogId: result.id,
          status: 'READY',
          lastSyncedAt: new Date(),
        },
      })
    } catch (err: any) {
      const errorMessage = err instanceof TokenError
        ? 'Token error — reconnect needed'
        : err instanceof RateLimitError
          ? 'Meta rate limited — try later'
          : err?.message ?? 'Unknown error'

      await prisma.metaCatalog.update({
        where: { id: catalog.id },
        data: { status: 'FAILED', errorMessage },
      })

      return NextResponse.json({
        catalog: await prisma.metaCatalog.findUnique({ where: { id: catalog.id } }),
        error: errorMessage,
      }, { status: 500 })
    }
  }

  return NextResponse.json({ catalog }, { status: 201 })
}
