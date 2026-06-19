/**
 * POST /api/cron/scan-campaigns
 * Batched cron: scan RUNNING sessions, fetch insights, evaluate rules, apply actions.
 * Write gate: ownership-driven via canWriteToAdAccount() — NOT env allowlist.
 * Schedule: every 5 minutes
 * Auth: x-cron-secret (CRON_SECRET env)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInsights, updateBudget, setStatus, TokenError, RateLimitError } from '@/lib/meta-client'
import { evaluateRule, resolveAction, parseConditionTree, MetricsMap } from '@/lib/rule-engine'
import { canWriteToAdAccount, markAccountNeedsReconnect, markAccountHealthy } from '@/lib/write-guard'
import { notify } from '@/lib/notify'

export const dynamic = 'force-dynamic'

const LIMIT = 30

function checkAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('x-cron-secret') === secret
    || req.headers.get('authorization') === `Bearer ${secret}`
}

async function run() {
  const now = new Date()

  // Strict opt-in: HANYA proses automationEnabled=true + nextMonitorAt due
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
      metaCampaignId: true,
      dailyBudget: true,
      budgetMode: true,
      primaryAdsetMetaId: true,
      monitorIntervalMinutes: true,
      metaAdAccount: {
        select: { id: true, adAccountId: true },
      },
      automationRules: {
        where: { status: 'ACTIVE' },
        orderBy: { priority: 'asc' },
      },
    },
  })

  let scanned = 0
  let rulesFired = 0
  let actionsApplied = 0
  let skipped: { sessionId: string; reason: string }[] = []

  for (const session of sessions) {
    scanned++
    const metaCampaignId = session.metaCampaignId
    const metaAdAccountId = session.metaAdAccount?.id ?? null

    if (!metaCampaignId || !metaAdAccountId) {
      await prisma.campaignSession.update({
        where: { id: session.id },
        data: { nextMonitorAt: new Date(now.getTime() + 60 * 60 * 1000) },
      })
      continue
    }

    // ★ Write gate: ownership + token check (fail-closed)
    const writeCheck = await canWriteToAdAccount(session.userId, metaAdAccountId)
    if (!writeCheck.ok) {
      skipped.push({ sessionId: session.id, reason: writeCheck.reason! })
      // Don't error-fatal — just skip and retry later
      await prisma.campaignSession.update({
        where: { id: session.id },
        data: { nextMonitorAt: new Date(now.getTime() + 15 * 60 * 1000) },
      })
      continue
    }

    const token = writeCheck.token!

    try {
      // Fetch fresh insights from Meta
      const insights = await getInsights(metaCampaignId, token, 'maximum')

      // ★ Observability: log jika insights kosong (e.g. campaign paused/no data)
      if (insights.spend === 0 && insights.impressions === 0 && insights.purchases === 0) {
        console.warn(`[scan-campaigns] no_insight_data session=${session.id} campaign=${metaCampaignId}`)
      }

      // Mark account healthy
      await markAccountHealthy(metaAdAccountId)

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
        if (rule.maxFireCount != null && rule.maxFireCount > 0 && (rule.fireCount ?? 0) >= rule.maxFireCount) continue

        // Parse condition
        let conditionTree
        try { conditionTree = parseConditionTree(rule.conditionTreeJson) } catch { continue }

        // Evaluate
        const evalResult = evaluateRule(conditionTree, metricsMap)

        // Record execution
        const dedupKey = `scan_${session.id}_${rule.id}_${now.toISOString().slice(0, 16)}`
        await prisma.ruleExecution.create({
          data: {
            ruleId: rule.id,
            campaignSessionId: session.id,
            ruleVersion: rule.version,
            conditionResultJson: JSON.stringify(evalResult.results),
            matched: evalResult.matched,
            evaluatedAt: now,
            deduplicationKey: dedupKey,
          },
        })

        if (!evalResult.matched) continue

        rulesFired++

        // Parse action spec
        let actionSpec
        try { actionSpec = JSON.parse(rule.actionSpecJson ?? '{}') } catch { continue }

        const currentBudget = Number(session.dailyBudget)
        const resolved = resolveAction(actionSpec, currentBudget)

        // Determine budget target level: CBO → campaign, ABO → adset
        const budgetMode = session.budgetMode ?? 'CBO'
        const entityId = budgetMode === 'ABO' && session.primaryAdsetMetaId
          ? session.primaryAdsetMetaId
          : metaCampaignId
        const budgetLevel = budgetMode === 'ABO' ? 'ADSET' as const : 'CAMPAIGN' as const

        // Apply action via Meta API
        try {
          if (resolved.payload.dailyBudget) {
            await updateBudget(entityId, resolved.payload.dailyBudget as number, token, budgetLevel)
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

          // Notify rule fired
          const budgetDesc = resolved.payload.dailyBudget
            ? `Budget ${resolved.payload.dailyBudget > currentBudget ? 'naik' : 'turun'} ke Rp${Number(resolved.payload.dailyBudget).toLocaleString()}`
            : ''
          const statusDesc = resolved.payload.status
            ? `Status jadi ${resolved.payload.status}`
            : ''
          await notify(session.userId, {
            type: 'rule_fired',
            severity: 'success',
            title: `Rule "${rule.name ?? rule.id}" fired`,
            body: [budgetDesc, statusDesc].filter(Boolean).join(' · ') || `Campaign ${metaCampaignId}`,
            refType: 'campaign_session',
            refId: session.id,
          }).catch(() => {})

          // Update rule fire count
          await prisma.automationRule.update({
            where: { id: rule.id },
            data: { fireCount: { increment: 1 }, lastFiredAt: now },
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

          // Notify write failed
          await notify(session.userId, {
            type: 'write_failed',
            severity: 'error',
            title: `Gagal terapkan rule "${rule.name ?? rule.id}"`,
            body: String(applyErr).slice(0, 200),
            refType: 'campaign_session',
            refId: session.id,
          }).catch(() => {})
        }
      }

      // Update nextMonitorAt dengan interval per-user
      const sess = await prisma.campaignSession.findUnique({
        where: { id: session.id }, select: { monitorIntervalMinutes: true },
      })
      const interval = sess?.monitorIntervalMinutes ?? 5 // default 5 menit
      await prisma.campaignSession.update({
        where: { id: session.id },
        data: { nextMonitorAt: new Date(now.getTime() + interval * 60 * 1000) },
      })
    } catch (err) {
      // Handle TokenError → mark account needs_reconnect
      if (err instanceof TokenError) {
        console.warn(`[scan-campaigns] TokenError for session ${session.id}:`, (err as Error).message)
        await markAccountNeedsReconnect(metaAdAccountId)
        await notify(session.userId, {
          type: 'token_expired',
          severity: 'error',
          title: 'Token Meta Ads kadaluwarsa',
          body: `Campaign ${metaCampaignId} tidak bisa discan. Hubungkan ulang akun Meta.`,
          refType: 'meta_account',
          refId: metaAdAccountId ?? undefined,
        }).catch(() => {})
      } else {
        console.error(`[scan-campaigns] Session ${session.id} error:`, err)
      }
      await prisma.campaignSession.update({
        where: { id: session.id },
        data: { nextMonitorAt: new Date(now.getTime() + 15 * 60 * 1000) },
      })
    }
  }

  return { scanned, rulesFired, actionsApplied, skipped: skipped.length }
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
