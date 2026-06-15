import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateHermesApiKey, extractBearerToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const CPAS_SPAWN_TYPES = ['cpas_spawn_plan', 'cpas_image_submit', 'cpas_image_poll', 'cpas_adset_write']

export async function GET(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const agent = await validateHermesApiKey(token)
  if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const campaignSessionId = searchParams.get('campaignSessionId')
  if (!campaignSessionId) {
    return NextResponse.json({ error: 'campaignSessionId is required' }, { status: 400 })
  }

  // Atomic query: cap + live active count + in-process spawn jobs
  const [session, activeAdsets, inProcessTasks] = await prisma.$transaction([
    prisma.campaignSession.findUnique({
      where: { id: campaignSessionId },
      select: { adsetCap: true, metaCampaignId: true },
    }),
    prisma.metaEntity.count({
      where: {
        campaignSessionId,
        entityType: 'ADSET',
        effectiveStatus: 'ACTIVE',
      },
    }),
    prisma.workerTask.count({
      where: {
        type: { in: CPAS_SPAWN_TYPES },
        status: { in: ['pending', 'processing'] },
        payloadJson: { contains: campaignSessionId },
      },
    }),
  ])

  if (!session) {
    return NextResponse.json({ error: 'CampaignSession not found' }, { status: 404 })
  }

  const cap = session.adsetCap ?? 0
  const freeSlots = Math.max(0, cap - activeAdsets - inProcessTasks)

  return NextResponse.json({
    cap,
    activeAdsets,
    inProcess: inProcessTasks,
    freeSlots,
    metaCampaignId: session.metaCampaignId,
  })
}
