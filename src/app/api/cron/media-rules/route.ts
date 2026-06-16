import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function checkCronAuth(req: NextRequest): boolean {
  const CRON_SECRET = process.env.CRON_SECRET
  if (!CRON_SECRET) return false
  const xSecret = req.headers.get('x-cron-secret')
  const bearer = req.headers.get('authorization')
  return xSecret === CRON_SECRET || bearer === `Bearer ${CRON_SECRET}`
}

interface RuleEvalResult {
  ruleId: string
  ruleName: string
  triggered: boolean
  reason: string
  taskId?: string
}

// POST /api/cron/media-rules — evaluasi semua MediaLibraryRule aktif
export async function POST(req: NextRequest) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const rules = await prisma.mediaLibraryRule.findMany({
    where: { status: 'ACTIVE' },
    include: {
      product: { select: { id: true, name: true } },
      character: { select: { id: true, name: true } },
    },
  })

  const results: RuleEvalResult[] = []

  for (const rule of rules) {
    // Cooldown check
    if (rule.lastTriggeredAt) {
      const cooldownMs = rule.cooldownHours * 60 * 60 * 1000
      if (now.getTime() - rule.lastTriggeredAt.getTime() < cooldownMs) {
        results.push({ ruleId: rule.id, ruleName: rule.name, triggered: false, reason: 'cooldown' })
        continue
      }
    }

    const scopeWhere = {
      status: 'READY' as const,
      type: rule.mediaType,
      ...(rule.productId ? { productId: rule.productId } : {}),
      ...(rule.characterId ? { characterId: rule.characterId } : {}),
    }

    let triggered = false
    let reason = ''

    if (rule.triggerType === 'MIN_COUNT') {
      const count = await prisma.mediaAsset.count({ where: scopeWhere })
      triggered = count < rule.threshold
      reason = `count=${count}, threshold=${rule.threshold}`
    } else if (rule.triggerType === 'MAX_AGE_DAYS') {
      const newest = await prisma.mediaAsset.findFirst({
        where: scopeWhere,
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      })
      const ageDays = newest
        ? (now.getTime() - newest.createdAt.getTime()) / (24 * 60 * 60 * 1000)
        : Infinity
      triggered = ageDays > rule.threshold
      reason = `newestAgeDays=${ageDays === Infinity ? 'none' : ageDays.toFixed(1)}, threshold=${rule.threshold}`
    } else if (rule.triggerType === 'NO_WINNER') {
      // Cek apakah ada creative variant dengan quality score di atas threshold
      const winnerCount = await prisma.creativeVariant.count({
        where: {
          ...(rule.productId ? { productId: rule.productId } : {}),
          qualityScore: { gte: rule.threshold },
        },
      })
      triggered = winnerCount === 0
      reason = `winners(score>=${rule.threshold})=${winnerCount}`
    }

    if (!triggered) {
      results.push({ ruleId: rule.id, ruleName: rule.name, triggered: false, reason })
      continue
    }

    let taskId: string | undefined

    if (rule.actionType === 'CREATE_TASK') {
      // Dedup: jangan buat task baru kalau masih ada task pending dari rule ini.
      // Match string lengkap dengan quote penutup supaya tidak kena substring rule lain.
      const dedupeKey = `media_rule:${rule.id}`
      const existing = await prisma.workerTask.findFirst({
        where: {
          type: rule.taskType ?? 'GENERATE_VIDEO',
          status: { in: ['pending', 'processing'] },
          payloadJson: { contains: `"dedupeKey":"${dedupeKey}"` },
        },
        select: { id: true },
      })

      if (existing) {
        results.push({ ruleId: rule.id, ruleName: rule.name, triggered: true, reason: `${reason} (task already pending: ${existing.id})` })
        continue
      }

      let extraPayload: Record<string, unknown> = {}
      if (rule.taskPayloadJson) {
        try { extraPayload = JSON.parse(rule.taskPayloadJson) } catch { /* payload corrupt — lanjut tanpa extra */ }
      }
      const task = await prisma.workerTask.create({
        data: {
          type: rule.taskType ?? 'GENERATE_VIDEO',
          capability: 'content_generation',
          payloadJson: JSON.stringify({
            dedupeKey,
            mediaRuleId: rule.id,
            mediaType: rule.mediaType,
            productId: rule.productId,
            productName: rule.product?.name,
            characterId: rule.characterId,
            characterName: rule.character?.name,
            userId: rule.userId,
            triggerReason: reason,
            ...extraPayload,
          }),
          priority: 5,
          scope: 'internal',
        },
      })
      taskId = task.id
    }

    await prisma.mediaLibraryRule.update({
      where: { id: rule.id },
      data: { lastTriggeredAt: now, triggerCount: { increment: 1 } },
    })

    results.push({ ruleId: rule.id, ruleName: rule.name, triggered: true, reason, taskId })
  }

  return NextResponse.json({
    evaluated: rules.length,
    triggered: results.filter(r => r.triggered).length,
    results,
  })
}

export async function GET(req: NextRequest) {
  return POST(req)
}
