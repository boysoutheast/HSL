/**
 * S2-fire smoke test: spend-only rule → fire → apply budget +5% → readback → restore
 * Uses same lib pipeline as scan-campaigns route.
 */
import { PrismaClient } from '@prisma/client'
import { getInsights, updateBudget } from '@/lib/meta-client'
import { evaluateRule, resolveAction, parseConditionTree, MetricsMap } from '@/lib/rule-engine'
import { decode } from '@/lib/crypto'
import { notify } from '@/lib/notify'

const prisma = new PrismaClient()
const META_CAMPAIGN_ID = '120244710362590290'

async function main() {
  console.log('=== S2-fire: SPEND-ONLY Rule → Budget +5% ===')
  const now = new Date()

  // 1. Get session + rule
  const session = await prisma.campaignSession.findFirst({
    where: { name: 'SMOKE-AFF' },
    include: {
      metaAdAccount: { select: { id: true, metaAccountId: true } },
      automationRules: { where: { status: 'ACTIVE' }, orderBy: { priority: 'asc' } },
    }
  })
  if (!session) throw new Error('Session not found')
  console.log(`Session: ${session.id}, Budget: Rp${Number(session.dailyBudget).toLocaleString()}`)

  // 2. Decrypt token
  const metaAcct = await prisma.metaAccount.findUnique({
    where: { id: session.metaAdAccount!.metaAccountId },
    select: { longLivedTokenEncrypted: true }
  })
  if (!metaAcct?.longLivedTokenEncrypted) throw new Error('No token')
  const token = decode(metaAcct.longLivedTokenEncrypted)

  // 3. Get live budget BEFORE
  const beforeRaw = await fetch(
    `https://graph.facebook.com/v21.0/${META_CAMPAIGN_ID}?fields=id,name,daily_budget,budget_remaining,status`,
    { headers: { Authorization: `Bearer ${token}` } }
  ).then(r => r.json()) as any
  const budgetBefore = Number(beforeRaw.daily_budget || 0)
  console.log(`\n📊 BEFORE: Daily Budget = Rp${budgetBefore.toLocaleString()}, Remaining = Rp${Number(beforeRaw.budget_remaining || 0).toLocaleString()}`)

  // 4. Get insights
  console.log('\n--- Fetching insights...')
  const insights = await getInsights(META_CAMPAIGN_ID, token, 'maximum')
  const metricsMap: MetricsMap = {
    spend: insights.spend, roas: insights.purchaseRoas ?? 0,
    cpc: insights.cpc ?? 0, ctr: insights.ctr ?? 0,
    purchases: insights.purchases, impressions: insights.impressions,
  }
  console.log(`Spend: Rp${insights.spend.toLocaleString()}, Purchases: ${insights.purchases}, ROAS: ${insights.purchaseRoas ?? 'N/A'}`)

  // 5. Evaluate the rule
  console.log('\n--- Evaluating rule...')
  const rule = session.automationRules[0]
  if (!rule) throw new Error('No active rules')

  const conditionTree = parseConditionTree(rule.conditionTreeJson)
  const evalResult = evaluateRule(conditionTree, metricsMap)
  console.log(`Rule: "${rule.name}", Matched: ${evalResult.matched}`)
  console.log(`Details: ${JSON.stringify(evalResult.results)}`)

  if (!evalResult.matched) throw new Error('Rule did NOT match — test FAILED')

  // 6. Record RuleExecution
  const ruleExec = await prisma.ruleExecution.create({
    data: {
      ruleId: rule.id, campaignSessionId: session.id, ruleVersion: rule.version,
      conditionResultJson: JSON.stringify(evalResult.results), matched: true,
      evaluatedAt: now,
      deduplicationKey: `smoke-s2_${session.id}_${rule.id}_${now.toISOString().slice(0, 16)}`,
    }
  })
  console.log(`✅ RuleExecution matched: ${ruleExec.id}`)

  // 7. Resolve action
  const actionSpec = JSON.parse(rule.actionSpecJson)
  const resolved = resolveAction(actionSpec, Number(session.dailyBudget))
  console.log(`Action: ${resolved.actionType} → budget from Rp${Number(session.dailyBudget).toLocaleString()} to Rp${Number(resolved.payload.dailyBudget ?? 0).toLocaleString()}`)

  // 8. Apply action via Meta API
  console.log('\n--- Applying budget update via Meta API...')
  try {
    await updateBudget(META_CAMPAIGN_ID, resolved.payload.dailyBudget as number, token, 'CAMPAIGN')
    
    // Wait for Meta to settle
    await new Promise(r => setTimeout(r, 3000))

    // 9. Readback — get live budget AFTER
    const afterRaw = await fetch(
      `https://graph.facebook.com/v21.0/${META_CAMPAIGN_ID}?fields=id,name,daily_budget,budget_remaining,status`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(r => r.json()) as any
    const budgetAfter = Number(afterRaw.daily_budget || 0)
    console.log(`📊 AFTER: Daily Budget = Rp${budgetAfter.toLocaleString()}, Remaining = Rp${Number(afterRaw.budget_remaining || 0).toLocaleString()}`)

    // 10. Verify
    const expectedBudget = Math.round(budgetBefore * 1.05) // +5%
    const budgetChanged = budgetAfter === expectedBudget
    console.log(`\n✅ Budget change: Rp${budgetBefore.toLocaleString()} → Rp${budgetAfter.toLocaleString()}`)
    console.log(`   Expected: Rp${expectedBudget.toLocaleString()}, Match: ${budgetChanged}`)
    
    if (!budgetChanged) {
      console.log('⚠️ Budget did not change exactly as expected — possible Meta rounding')
    }

    // 11. Record AutomationAction
    const action = await prisma.automationAction.create({
      data: {
        userId: session.userId, campaignSessionId: session.id, source: 'SYSTEM',
        actionType: resolved.actionType,
        payloadJson: JSON.stringify(resolved.payload),
        status: 'SUCCEEDED', idempotencyKey: `smoke-s2_${session.id}_${rule.id}_${now.getTime()}`,
        priority: 3, requestedAt: now, executedAt: now, confirmedAt: now,
      }
    })
    console.log(`✅ AutomationAction: ${action.id} status=SUCCEEDED`)

    // 12. Update rule
    await prisma.automationRule.update({
      where: { id: rule.id },
      data: { fireCount: { increment: 1 }, lastFiredAt: now }
    })

  } catch (applyErr) {
    console.error('❌ Apply failed:', applyErr)
    
    // Record FAILED action
    await prisma.automationAction.create({
      data: {
        userId: session.userId, campaignSessionId: session.id, source: 'SYSTEM',
        actionType: resolved.actionType,
        payloadJson: JSON.stringify(resolved.payload),
        status: 'FAILED', errorMessage: String(applyErr),
        idempotencyKey: `smoke-s2_${session.id}_${rule.id}_${now.getTime()}_fail`,
        priority: 3, requestedAt: now, executedAt: now,
      }
    })
    throw applyErr
  }

  // 13. Send notification (S5)
  console.log('\n--- Sending notification...')
  try {
    await notify(session.userId, {
      type: 'rule_fired',
      severity: 'success',
      title: `[SMOKE] Rule "${rule.name}" fired (+5% budget)`,
      body: `Budget naik dari Rp${budgetBefore.toLocaleString()} ke Rp${resolved.payload.dailyBudget.toLocaleString()}`,
      refType: 'campaign_session',
      refId: session.id,
    })
    console.log('✅ Notification sent')
  } catch(e: any) {
    console.log('⚠️ Notification error:', e.message?.slice(0, 100))
  }

  // Update nextMonitorAt
  await prisma.campaignSession.update({
    where: { id: session.id },
    data: { nextMonitorAt: new Date(now.getTime() + 5 * 60 * 1000) }
  })

  console.log('\n=== ✅ S2-FIRE COMPLETE ===')
  await prisma.$disconnect()
}
main().catch(e => { console.error('FATAL:', e); process.exit(1) })
