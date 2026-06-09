import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateApiKey, unauthorizedResponse } from '../../_lib/api-key-auth'

export const runtime = 'nodejs'

/**
 * POST /api/internal/worker/heartbeat
 * Updates WorkerRegistry row, upserts if doesn't exist.
 * Input: { workerId, mode, version, activeTaskCount, capacity, health }
 */
export async function POST(req: NextRequest) {
  if (!validateApiKey(req)) {
    return unauthorizedResponse()
  }

  let body: {
    workerId: string
    mode?: string
    version?: string
    activeTaskCount?: number
    capacity?: number
    health?: string
    instanceId?: string
    metadata?: Record<string, unknown>
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    workerId,
    mode = 'standard',
    version,
    activeTaskCount = 0,
    capacity,
    health = 'healthy',
    instanceId,
    metadata,
  } = body

  if (!workerId) {
    return NextResponse.json({ error: 'workerId is required' }, { status: 400 })
  }

  const now = new Date()

  try {
    const maxConcurrency = capacity ?? 5
    const metadataJson = metadata ? JSON.stringify(metadata) : null

    // Upsert WorkerRegistry - status reflects health state
    const workerStatus = health === 'healthy' ? 'ACTIVE' : 'ERROR'
    const worker = await prisma.workerRegistry.upsert({
      where: { workerId },
      create: {
        workerId,
        mode,
        version,
        instanceId,
        status: workerStatus,
        startedAt: now,
        lastHeartbeatAt: now,
        activeTaskCount,
        maxConcurrency,
        metadataJson,
      },
      update: {
        mode,
        version,
        instanceId,
        status: workerStatus,
        lastHeartbeatAt: now,
        activeTaskCount,
        maxConcurrency,
        metadataJson,
      },
    })

    // Log heartbeat event
    await prisma.workerHeartbeatEvent.create({
      data: {
        workerId,
        severity: health === 'healthy' ? 'INFO' : 'WARNING',
        eventType: 'HEARTBEAT',
        message: `Worker heartbeat: ${health}`,
        metadataJson: metadata ? JSON.stringify(metadata) : null,
      },
    })

    return NextResponse.json({
      workerId,
      status: worker.status,
      lastHeartbeatAt: now.toISOString(),
      activeTaskCount,
      maxConcurrency,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Failed to update heartbeat', message }, { status: 500 })
  }
}
