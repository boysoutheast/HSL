import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateApiKey, unauthorizedResponse } from '../../_lib/api-key-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface EntityInput {
  entityType: string // CAMPAIGN | ADSET | AD | CREATIVE
  metaEntityId: string
  parentMetaEntityId?: string
  name: string
  configuredStatus?: string
  effectiveStatus?: string
  deliveryStatus?: string
  rawStateJson?: string
}

/**
 * POST /api/internal/meta-entities/upsert
 * Worker syncs Meta campaign structure (campaign+adset+ad) into MetaEntity mirror.
 * Body: { campaignSessionId, userId, metaAdAccountId, entities: EntityInput[] }
 * Upsert key: (metaAdAccountId, entityType, metaEntityId).
 */
export async function POST(req: NextRequest) {
  if (!validateApiKey(req)) return unauthorizedResponse()

  let body: {
    campaignSessionId: string
    userId: string
    metaAdAccountId: string
    entities: EntityInput[]
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.campaignSessionId || !body.userId || !body.metaAdAccountId || !Array.isArray(body.entities)) {
    return NextResponse.json(
      { error: 'campaignSessionId, userId, metaAdAccountId, and entities[] are required' },
      { status: 400 },
    )
  }
  if (body.entities.length === 0) {
    return NextResponse.json({ upserted: 0 })
  }
  if (body.entities.length > 500) {
    return NextResponse.json({ error: 'Max 500 entities per request' }, { status: 400 })
  }

  // Validate session exists + matches the user (fail-closed)
  const session = await prisma.campaignSession.findFirst({
    where: { id: body.campaignSessionId, userId: body.userId },
    select: { id: true },
  })
  if (!session) {
    return NextResponse.json({ error: 'Campaign session not found' }, { status: 404 })
  }

  const now = new Date()
  let upserted = 0

  for (const e of body.entities) {
    if (!e.entityType || !e.metaEntityId || !e.name) continue
    await prisma.metaEntity.upsert({
      where: {
        metaAdAccountId_entityType_metaEntityId: {
          metaAdAccountId: body.metaAdAccountId,
          entityType: e.entityType,
          metaEntityId: e.metaEntityId,
        },
      },
      create: {
        userId: body.userId,
        campaignSessionId: body.campaignSessionId,
        metaAdAccountId: body.metaAdAccountId,
        entityType: e.entityType,
        metaEntityId: e.metaEntityId,
        parentMetaEntityId: e.parentMetaEntityId ?? null,
        name: e.name,
        configuredStatus: e.configuredStatus ?? null,
        effectiveStatus: e.effectiveStatus ?? null,
        deliveryStatus: e.deliveryStatus ?? null,
        rawStateJson: e.rawStateJson ?? null,
        lastSyncedAt: now,
      },
      update: {
        campaignSessionId: body.campaignSessionId,
        parentMetaEntityId: e.parentMetaEntityId ?? null,
        name: e.name,
        configuredStatus: e.configuredStatus ?? null,
        effectiveStatus: e.effectiveStatus ?? null,
        deliveryStatus: e.deliveryStatus ?? null,
        rawStateJson: e.rawStateJson ?? null,
        lastSyncedAt: now,
      },
    })
    upserted++
  }

  return NextResponse.json({ upserted })
}
