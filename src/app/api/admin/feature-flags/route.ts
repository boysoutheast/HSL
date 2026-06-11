import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const scope = searchParams.get('scope')
  const enabled = searchParams.get('enabled')

  const where: Record<string, unknown> = {}
  if (scope) where.scope = scope
  if (enabled !== null) where.enabled = enabled === 'true'

  const flags = await prisma.featureFlag.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ flags })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    key: string
    name: string
    description?: string
    enabled?: boolean
    scope?: string
    targetId?: string
    config?: Record<string, unknown>
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.key) {
    return NextResponse.json({ error: 'key is required' }, { status: 400 })
  }

  const flag = await prisma.featureFlag.create({
    data: {
      key: body.key,
      name: body.name || body.key,
      description: body.description,
      enabled: body.enabled ?? false,
      scope: body.scope ?? 'global',
      targetId: body.targetId,
      config: body.config as Prisma.InputJsonValue | undefined,
    },
  })

  return NextResponse.json({ flag }, { status: 201 })
}
