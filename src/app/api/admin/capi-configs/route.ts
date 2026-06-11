import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { encode, redact } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

// GET /api/admin/capi-configs
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const configs = await prisma.capiEventConfig.findMany({
    where: auth.role === 'admin' ? {} : { userId: auth.id },
    orderBy: { createdAt: 'desc' },
  })

  // Jangan pernah kirim token ke client
  return NextResponse.json({
    configs: configs.map(c => ({
      ...c,
      accessTokenEncrypted: undefined,
      accessTokenPreview: redact(c.accessTokenEncrypted ? '****************' : null),
    })),
  })
}

// POST /api/admin/capi-configs
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const { name, pixelId, accessToken, testEventCode, allowedEvents, landingPageId } = body
  if (!name?.trim() || !pixelId?.trim() || !accessToken?.trim()) {
    return NextResponse.json({ error: 'name, pixelId, accessToken are required' }, { status: 400 })
  }

  const config = await prisma.capiEventConfig.create({
    data: {
      userId: auth.id,
      name: name.trim(),
      pixelId: pixelId.trim(),
      accessTokenEncrypted: encode(accessToken.trim()),
      testEventCode: testEventCode?.trim() || null,
      ...(Array.isArray(allowedEvents) && allowedEvents.length > 0 ? { allowedEvents } : {}),
      landingPageId: landingPageId ?? null,
    },
  })

  return NextResponse.json(
    { config: { ...config, accessTokenEncrypted: undefined } },
    { status: 201 }
  )
}
