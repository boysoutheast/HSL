import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  let settings = await prisma.postingMonitorSetting.findFirst({
    orderBy: { createdAt: 'asc' },
  })

  if (!settings) {
    settings = await prisma.postingMonitorSetting.create({ data: {} })
  }

  return NextResponse.json({ settings })
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    checkIntervalMinutes?: number
    minimumDecisionAgeMinutes?: number
    deadEarlyAgeMinutes?: number
    stuckThresholdPercentPerHour?: number
    growingThresholdPercentPerHour?: number
    hotThresholdPercentPerHour?: number
    stuckConfirmationCount?: number
    hotLockDurationMinutes?: number
    maxPostPerDay?: number
    minimumGapUploadMinutes?: number
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  let settings = await prisma.postingMonitorSetting.findFirst({
    orderBy: { createdAt: 'asc' },
  })

  const settingKeys = ['checkIntervalMinutes', 'minimumDecisionAgeMinutes', 'deadEarlyAgeMinutes', 'stuckThresholdPercentPerHour', 'growingThresholdPercentPerHour', 'hotThresholdPercentPerHour', 'stuckConfirmationCount', 'hotLockDurationMinutes', 'maxPostPerDay', 'minimumGapUploadMinutes']
  const updateData: Record<string, number> = {}
  for (const key of settingKeys) {
    const val = (body as Record<string, unknown>)[key]
    if (val !== undefined && typeof val === 'number' && isFinite(val) && val >= 0) {
      ;(updateData as Record<string, unknown>)[key] = val
    }
  }

  if (!settings) {
    settings = await prisma.postingMonitorSetting.create({ data: updateData })
  } else {
    settings = await prisma.postingMonitorSetting.update({
      where: { id: settings.id },
      data: updateData,
    })
  }

  return NextResponse.json({ settings })
}
