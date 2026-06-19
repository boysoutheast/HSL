/**
 * POST /api/cron/scan-campaigns
 * Batched cron: scan RUNNING sessions, fetch insights, evaluate rules, apply actions.
 * Allowlist guard: HSL_WRITE_ALLOWED_AD_ACCOUNTS env.
 * Schedule: */5 * * * *
 * Auth: x-cron-secret (CRON_SECRET env)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInsights, updateBudget, setStatus, TokenError, RateLimitError } from '@/lib/meta-client'
import { evaluateRule, resolveAction, parseConditionTree, MetricsMap } from '@/lib/rule-engine'

export const dynamic = 'force-dynamic'

const LIMIT = 30

function checkAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('x-cron-secret') === secret
    || req.headers.get('authorization') === `Bearer ${secret}`
}

/** Decrypt token (same logic as sync-campaigns) */
function decryptToken(encrypted: string): string {
  const crypto = require('crypto')
  const key = process.env.ENCRYPTION_KEY
  if (!key) throw new Error('ENCRYPTION_KEY not set')
  const parts = encrypted.split(':')
  const iv = Buffer.from(parts[0], 'hex')
  const enc = Buffer.from(parts[1], 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key.padEnd(32, 'x').slice(0, 32)), iv)
  return decipher.update(enc, undefined, 'utf8') + decipher.final('utf8')
}

/** Check if ad account ID (act_xxx or numeric) is in the allowlist */
function isAllowed(adAccountId: string): boolean {
  const allowlist = (process.env.HSL_WRITE_ALLOWED_AD_ACCOUNTS ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (allowlist.length === 0) return true // no allowlist = allow all
  const numericId = adAccountId.replace(/^act_/, '')
  return allowlist.some(a => a === numericId || a === adAccountId)
}

async function run() {
  const now = new Date()

  const sessions = await prisma.campaignSession.findMany({
    where: {
      status: 'RUNNING',
      automationEnabled: true,
      OR: [
        { nextMonitorAt: { lte: now } },
        { nextMonitorAt: null },
      ],
    },
    take: LIMIT,
    orderBy: { nextMonitorAt: { sort: 'asc', nulls: 'first' } },
    select: {
      id: true,
      userId: true,
      dailyBudget: true,
      metaCampaignId: true,
      metaAdAccountId: true,
      metaAdAccount: {
        select: {
          adAccountId: true,
          metaAccount: { select: { longLivedTokenEncrypted: true } },
        },
      },
      automationRules: {
        where: { status: 'ACTIVE' },
        orderBy: { priority: 'asc' },
        select: {
          id: true,
          name: true,
          conditionJson: true,
          actionSpecJson: true,
          cooldownMinutes: true,
          maxFireCount: true,
          fireCount: true,
          lastFiredAt: true,
          minimumDataAge: true,
        },
      },
      metaEntities: {
        where: { entityType: { in: ['CAMPAIGN', 'ADSET', 'AD'] } },
        select: {
          id: true,
          metaEntityId: true,
          entityType: true,
          metricSnapshots: {
            orderBy: { windowEnd: 'desc' },
            take: 1,
            select: { spend: true, roas: true, cpc: true, ctr: true, purchases: true, impressions: true, windowEnd: true },
          },
        },
      },
    },
  })

  let scanned = 0
  let rulesFired = 0
  let actionsApplied = 0

  for (const session of sessions) {
    scanned++
    const encryptedToken = session.metaAdAccount?.metaAccount?.longLivedTokenEncrypted
    const adAccountId = session.metaAdAccount?.adAccountId
    const metaCampaignId = session.metaCampaignId

    if (!encryptedToken || !adAccountId || !metaCampaignId) {
      await prisma.campaignSession.update({
        where: { id: session.id },
        data: { nextMonitorAt: new Date(now.getTime() + 60 * 60 * 1000) }, // retry in 1h
      })
      continue
    }

    try {
      const token = decryptToken(encryptedToken)

      // Fetch fresh insights from Meta
      const insights = await getInsights(metaCampaignId, token, 'maximum')

      // Save metric snapshot
      const metricsMap: MetricsMap = {
        spend: insights.spend,
        roas: insights.purchaseRoas ?? 0,
        cpc: insights.cpc ?? 0,
        ctr: insights.ctr ?? 0,
        purchases: insights.purchases,
        impressions: insights.impressions,
      }

      // Evaluate each rule
      for (const rule of session.automationRules) {
        // Cooldown check
        if (rule.lastFiredAt) {
          const cooldownMs = (rule.cooldownMinutes ?? 60) * 60 * 1000
          if (now.getTime() - rule.lastFiredAt.getTime() < cooldownMs) continue
        }

        // Max fire count check
        if (rule.maxFireCount > 0 && rule.fireCount >= rule.maxFireCount) continue

        // Parse condition
        let conditionTree
        try {
          conditionTree = parseConditionTree(rule.conditionJson)
        } catch {
          continue
        }

        // Evaluate
        const evalResult = evaluateRule(conditionTree, metricsMap)

        // Record execution
        const dedupKey = `scan_${session.id}_${rule.id}_${now.toISOString().slice(0, 16)}`
        await prisma.ruleExecution.create({
          data: {
            ruleId: rule.id,
            campaignSessionId: session.id,
            conditionResultJson: JSON.stringify(evalResult.results),
            matched: evalResult.matched,
            deduplicationKey: dedupKey,
          },
        })

        if (!evalResult.matched) continue
        if (!isAllowed(adAccountId)) {
          console.warn(`[scan-campaigns] Skip action on ${adAccountId} — not in allowlist`)
          continue
        }

        rulesFired++

        // Parse action spec
        let actionSpec
        try {
          actionSpec = JSON.parse(rule.actionSpecJson ?? '{}')
        } catch {
          continue
        }

        const currentBudget = Number(session.dailyBudget)
        const resolved = resolveAction(actionSpec, currentBudget)

        // Apply action via Meta API
        try {
          const entityId = metaCampaignId // apply to campaign level

          if (resolved.payload.dailyBudget) {
            await updateBudget(entityId, resolved.payload.dailyBudget as number, token)
          }
          if (resolved.payload.status) {
            await setStatus(entityId, resolved.payload.status as 'ACTIVE' | 'PAUSED', token)
          }

          // Record AutomationAction
          await prisma.automationAction.create({
            data: {
              userId: session.userId,
              campaignSessionId: session.id,
              source: 'SYSTEM',
              actionType: resolved.actionType,
              payloadJson: JSON.stringify(resolved.payload),
              status: 'SUCCEEDED',
              idempotencyKey: `scan_${session.id}_${rule.id}_${now.getTime()}`,
              priority: 3,
              requestedAt: now,
              executedAt: now,
              confirmedAt: now,
            },
          })

          // Update rule fire count
          await prisma.automationRule.update({
            where: { id: rule.id },
            data: {
              fireCount: { increment: 1 },
              lastFiredAt: now,
            },
          })

          actionsApplied++
        } catch (applyErr) {
          console.error(`[scan-campaigns] Apply action failed for rule ${rule.id}:`, applyErr)
          await prisma.automationAction.create({
            data: {
              userId: session.userId,
              campaignSessionId: session.id,
              source: 'SYSTEM',
              actionType: resolved.actionType,
              payloadJson: JSON.stringify(resolved.payload),
              status: 'FAILED',
              errorMessage: String(applyErr),
              idempotencyKey: `scan_${session.id}_${rule.id}_${now.getTime()}_fail`,
              priority: 3,
              requestedAt: now,
              executedAt: now,
            },
          })
        }
      }

      // Update nextMonitorAt
      const existing = session.metaEntities?.[0]?.metricSnapshots?.[0]
      const sessionSession = await prisma.campaignSession.findUnique({
        where: { id: session.id }, select: { monitorIntervalMinutes: true },
      })
      const interval = sessionSession?.monitorIntervalMinutes ?? 15
      await prisma.campaignSession.update({
        where: { id: session.id },
        data: { nextMonitorAt: new Date(now.getTime() + interval * 60 * 1000) },
      })
    } catch (err) {
      console.error(`[scan-campaigns] Session ${session.id} error:`, err)
      await prisma.campaignSession.update({
        where: { id: session.id },
        data: { nextMonitorAt: new Date(now.getTime() + 15 * 60 * 1000) }, // retry in 15m
      })
    }
  }

  return { scanned, rulesFired, actionsApplied }
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    console.warn('[scan-campaigns] Unauthorized')
    return NextResponse.json({ ok: false, error: 'Unauthorized', ts: new Date().toISOString() })
  }
  try {
    const result = await run()
    return NextResponse.json({ ok: true, ...result, ts: new Date().toISOString() })
  } catch (err) {
    console.error('[scan-campaigns] Error:', err)
    return NextResponse.json({ ok: false, error: String(err), ts: new Date().toISOString() })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
