import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/internal/feature-flags/check?key=creative_topup&scope=user&targetId=xxx
 * Returns { enabled: bool, config: {} }
 * No auth required — internal service call only.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  const scope = searchParams.get('scope') || 'global'
  const targetId = searchParams.get('targetId') || null

  if (!key) {
    return NextResponse.json({ error: 'key query parameter is required' }, { status: 400 })
  }

  const flag = await prisma.featureFlag.findFirst({
    where: {
      key,
      OR: [
        { scope: 'global' },
        { scope, targetId },
      ],
    },
    orderBy: [
      // Prefer global flags, then scope-specific (more specific first)
      { scope: 'asc' },
    ],
  })

  if (!flag) {
    return NextResponse.json({ enabled: false, config: null })
  }

  return NextResponse.json({
    enabled: flag.enabled,
    config: flag.config ?? {},
  })
}
