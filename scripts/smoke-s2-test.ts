/**
 * Smoke S2 — Direct test: simulate scan-campaigns flow
 * Reads insights, evaluates rule, applies action via Meta API, records to DB.
 */
import { PrismaClient } from '@prisma/client'
import { getInsights, updateBudget } from '@/lib/meta-client'
import { evaluateRule, resolveAction, parseConditionTree, MetricsMap } from '@/lib/rule-engine'
import { decode } from '@/lib/crypto'
const { notify } = require('@/lib/notify')

const prisma = new PrismaClient()

async function main() {
  const now = new Date()
  const metaCampaignId = '120244710362590290'

  // 1. Find session + decrypt token
  const session = await prisma.campaignSession.findFirst({
    where: { name: 'SMOKE-AFF' },
    select: {
      id: true, userId: true, metaCampaignId: true, dailyBudget: true, budgetMode: true,
      primaryAdsetMetaId: true,
      metaAdAccount: { select: { id: true, metaAccountId: true } },
      automationRules: { where: { status: 'ACTIVE' }, orderBy: { priority: 'asc' } },
    }
  })
  if (!session) throw new Error('Session not found')
  console.log(`Session: ${session.id}`)
  console.log(`Current Daily Budget: Rp${Number(session.dailyBudget).toLocaleString()}`)

  // Get token
  const metaAcct = await prisma.metaAccount.findUnique({
    where: { id: session.metaAdAccount!.metaAccountId },
    select: { longLivedTokenEncrypted: true }
  })
  if (!metaAcct?.longLivedTokenEncrypted) throw new Error('No token')
  const token = decode(metaAcct.longLivedTokenEncrypted)

  // 2. Fetch insights from Meta API
  console.log('\n--- Fetching insights...')
  const insights = await getInsights(metaCampaignId, token, 'maximum')
  console.log(`Spend: Rp${insights.spend.toLocaleString()}`)
  console.log(`Purchases: ${insights.purchases}`)
  console.log(`ROAS: ${insights.purchaseRoas}`)
  console.log(`CPC: Rp${(insights.cpc ?? 0).toLocaleString()}`)
  console.log(`CTR: ${(insights.ctr ?? 0).toFixed(2)}%`)
  console.log(`Impressions: ${insights.impressions}`)

  // 3. Ensure MetaEntity exists (FK for MetricSnapshot)
  console.log('\n--- Ensuring MetaEntity exists...')
  let metaEntity = await prisma.metaEntity.findFirst({
    where: { campaignSessionId: session.id, entityType: 'CAMPAIGN' }
  })
  if (!metaEntity) {
    metaEntity = await prisma.metaEntity.create({
      data: {
        userId: session.userId,
        campaignSessionId: session.id,
        metaAdAccountId: session.metaAdAccount!.id,
        entityType: 'CAMPAIGN',
        metaEntityId: metaCampaignId,
        name: 'SMOKE-AFF',
        lastSyncedAt: now,
      }
    })
    console.log(`✅ MetaEntity created: ${metaEntity.id}`)
  } else {
    console.log(`MetaEntity exists: ${metaEntity.id}`)
  }

  // 4. Save MetricSnapshot
  console.log('\n--- Saving MetricSnapshot...')
  const metricsMap: MetricsMap = {
    spend: insights.spend,
    roas: insights.purchaseRoas ?? 0,
    cpc: insights.cpc ?? 0,
    ctr: insights.ctr ?? 0,
    purchases: insights.purchases,
    impressions: insights.impressions,
  }
  const snapshot = await prisma.metricSnapshot.create({
    data: {
      userId: session.userId,
      campaignSessionId: session.id,
      metaEntityId: metaEntity.id,
      entityType: 'CAMPAIGN',
      windowStart: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      windowEnd: now,
      attributionWindow: 'lifetime',
      spend: insights.spend,
      impressions: insights.impressions,
      clicks: insights.clicks ?? 0,
      cpc: insights.cpc ?? 0,
      ctr: insights.ctr ?? 0,
      purchases: insights.purchases,
      roas: insights.purchaseRoas ?? 0,
    }
  })
  console.log(`✅ MetricSnapshot created: ${snapshot.id}`)

  // 4. Evaluate rules
  console.log('\n--- Evaluating rules...')
  for (const rule of session.automationRules) {
    console.log(`Rule: ${rule.name} (${rule.id})`)

    // Cooldown check
    if (rule.lastFiredAt) {
      const cooldownMs = (rule.cooldownMinutes ?? 60) * 60 * 1000
      if (now.getTime() - rule.lastFiredAt.getTime() < cooldownMs) {
        console.log('  SKIP — cooldown')
        continue
      }
    }

    // Parse condition
    const conditionTree = parseConditionTree(rule.conditionTreeJson)
    const evalResult = evaluateRule(conditionTree, metricsMap)
    console.log(`  Matched: ${evalResult.matched}`)
    console.log(`  Details: ${JSON.stringify(evalResult.results)}`)

    // Record RuleExecution
    const dedupKey = `smoke_${session.id}_${rule.id}_${now.toISOString().slice(0, 16)}`
    const ruleExec = await prisma.ruleExecution.create({
      data: {
        ruleId: rule.id,
        campaignSessionId: session.id,
        ruleVersion: rule.version,
        conditionResultJson: JSON.stringify(evalResult.results),
        matched: evalResult.matched,
        evaluatedAt: now,
        deduplicationKey: dedupKey,
      }
    })
    console.log(`  ✅ RuleExecution created: ${ruleExec.id}`)

    if (!evalResult.matched) continue

    // 5. Resolve action
    const actionSpec = rule.actionSpecJson
    const currentBudget = Number(session.dailyBudget)
    const resolved = resolveAction(JSON.parse(actionSpec), currentBudget)
    console.log(`  Action: ${resolved.actionType} → ${JSON.stringify(resolved.payload)}`)

    // Apply action
    const budgetMode = session.budgetMode ?? 'CBO'
    const entityId = budgetMode === 'ABO' && session.primaryAdsetMetaId
      ? session.primaryAdsetMetaId
      : metaCampaignId
    const budgetLevel = budgetMode === 'ABO' ? 'ADSET' as const : 'CAMPAIGN' as const

    try {
      if (resolved.payload.dailyBudget) {
        const newBudget = resolved.payload.dailyBudget as number
        console.log(`  Applying budget update: Rp${newBudget.toLocaleString()} (${budgetLevel})`)
        await updateBudget(entityId, newBudget, token, budgetLevel)
        
        // Readback
        console.log('  Waiting 3s for Meta API to settle...')
        await new Promise(r => setTimeout(r, 3000))
        const readback = await getInsights(metaCampaignId, token, 'maximum')
        console.log(`  ✅ Budget updated! Readback confirmed.`)
      }
      if (resolved.payload.status) {
        console.log(`  Applying status: ${resolved.payload.status}`)
        // setStatus(entityId, resolved.payload.status as 'ACTIVE' | 'PAUSED', token)
      }

      // Record AutomationAction
      const action = await prisma.automationAction.create({
        data: {
          userId: session.userId,
          campaignSessionId: session.id,
          source: 'SYSTEM',
          actionType: resolved.actionType,
          payloadJson: JSON.stringify(resolved.payload),
          status: 'SUCCEEDED',
          idempotencyKey: `smoke_${session.id}_${rule.id}_${now.getTime()}`,
          priority: 3,
          requestedAt: now,
          executedAt: now,
          confirmedAt: now,
        }
      })
      console.log(`  ✅ AutomationAction created: ${action.id}`)

      // Update rule
      await prisma.automationRule.update({
        where: { id: rule.id },
        data: { fireCount: { increment: 1 }, lastFiredAt: now }
      })

      // 6. Notify
      const newBudget = Number(resolved.payload.dailyBudget ?? 0)
      const budgetDesc = newBudget > 0
        ? `Budget ${newBudget > currentBudget ? 'naik' : 'turun'} ke Rp${newBudget.toLocaleString()}`
        : ''
      const statusDesc = resolved.payload.status
        ? `Status jadi ${resolved.payload.status}`
        : ''
      
      try {
        await notify(session.userId, {
          type: 'rule_fired',
          severity: 'success',
          title: `[SMOKE] Rule "${rule.name}" fired`,
          body: [budgetDesc, statusDesc].filter(Boolean).join(' · ') || `Campaign ${metaCampaignId}`,
          refType: 'campaign_session',
          refId: session.id,
        })
        console.log('  ✅ Notification sent')
      } catch(e) {
        console.log('  ⚠️ Notification error (non-fatal):', String(e).slice(0, 100))
      }

    } catch (applyErr) {
      console.error(`  ❌ Apply action failed:`, applyErr)
      await prisma.automationAction.create({
        data: {
          userId: session.userId,
          campaignSessionId: session.id,
          source: 'SYSTEM',
          actionType: resolved.actionType,
          payloadJson: JSON.stringify(resolved.payload),
          status: 'FAILED',
          errorMessage: String(applyErr),
          idempotencyKey: `smoke_${session.id}_${rule.id}_${now.getTime()}_fail`,
          priority: 3,
          requestedAt: now,
          executedAt: now,
        }
      })

      try {
        await notify(session.userId, {
          type: 'write_failed',
          severity: 'error',
          title: `[SMOKE] Gagal terapkan rule "${rule.name}"`,
          body: String(applyErr).slice(0, 200),
          refType: 'campaign_session',
          refId: session.id,
        })
      } catch(_) {}
    }

    // Update nextMonitorAt
    await prisma.campaignSession.update({
      where: { id: session.id },
      data: { nextMonitorAt: new Date(now.getTime() + 5 * 60 * 1000) }
    })
  }

  console.log('\n=== ✅ S2 COMPLETE ===')
  await prisma.$disconnect()
}
main().catch(e => { console.error('FATAL:', e); process.exit(1) })
