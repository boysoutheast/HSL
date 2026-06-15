/**
 * CPAS Kill Rules Seed
 * Run: CPAS_ADMIN_USER_ID=<id> npx ts-node --project tsconfig.json prisma/cpas-seed.ts
 * Or: npx tsx prisma/cpas-seed.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CPAS_RULES = [
  {
    name: 'CPAS Purchase T1 — Zero Purchase Early Kill',
    description: 'Spend ≥ Rp10k, catalog ROAS ≤ 2.0, purchases = 0 → KILL adset',
    scope: 'ADSET',
    ruleCategory: 'THRESHOLD',
    conditionTreeJson: JSON.stringify({
      operator: 'AND',
      conditions: [
        { field: 'spend', op: 'gte', value: 10000 },
        { field: 'catalogSegmentROAS', op: 'lte', value: 2.0 },
        { field: 'catalogSegmentPurchases', op: 'eq', value: 0 },
      ],
    }),
    actionSpecJson: JSON.stringify({
      type: 'KILL_ADSET',
      killTier: 'T1',
      renamePrefix: '(KILL)',
      logGraveyard: true,
    }),
    evaluationWindowMinutes: 60,
    cooldownMinutes: 0,
    priority: 1,
  },
  {
    name: 'CPAS Purchase T2 — High CPLC Kill',
    description: 'Spend ≥ Rp20k, CPLC > Rp4000 → KILL adset',
    scope: 'ADSET',
    ruleCategory: 'THRESHOLD',
    conditionTreeJson: JSON.stringify({
      operator: 'AND',
      conditions: [
        { field: 'spend', op: 'gte', value: 20000 },
        { field: 'cplc', op: 'gt', value: 4000 },
      ],
    }),
    actionSpecJson: JSON.stringify({
      type: 'KILL_ADSET',
      killTier: 'T2',
      renamePrefix: '(KILL)',
      logGraveyard: true,
    }),
    evaluationWindowMinutes: 60,
    cooldownMinutes: 0,
    priority: 2,
  },
  {
    name: 'CPAS Purchase T3 — Low ROAS Sustained Kill',
    description: 'Spend ≥ Rp50k, catalog ROAS < 0.5 → KILL adset',
    scope: 'ADSET',
    ruleCategory: 'THRESHOLD',
    conditionTreeJson: JSON.stringify({
      operator: 'AND',
      conditions: [
        { field: 'spend', op: 'gte', value: 50000 },
        { field: 'catalogSegmentROAS', op: 'lt', value: 0.5 },
      ],
    }),
    actionSpecJson: JSON.stringify({
      type: 'KILL_ADSET',
      killTier: 'T3',
      renamePrefix: '(KILL)',
      logGraveyard: true,
    }),
    evaluationWindowMinutes: 60,
    cooldownMinutes: 0,
    priority: 3,
  },
  {
    name: 'CPAS ATC T1 — Zero Add-to-Cart Kill',
    description: 'Spend ≥ Rp10k, add_to_cart = 0 → KILL adset',
    scope: 'ADSET',
    ruleCategory: 'THRESHOLD',
    conditionTreeJson: JSON.stringify({
      operator: 'AND',
      conditions: [
        { field: 'spend', op: 'gte', value: 10000 },
        { field: 'addToCartCount', op: 'eq', value: 0 },
      ],
    }),
    actionSpecJson: JSON.stringify({
      type: 'KILL_ADSET',
      killTier: 'T1',
      renamePrefix: '(KILL)',
      logGraveyard: true,
    }),
    evaluationWindowMinutes: 60,
    cooldownMinutes: 0,
    priority: 1,
  },
  {
    name: 'CPAS ATC T2 — High CPLC on ATC Campaign',
    description: 'CPLC > Rp2500 → KILL adset',
    scope: 'ADSET',
    ruleCategory: 'THRESHOLD',
    conditionTreeJson: JSON.stringify({
      operator: 'AND',
      conditions: [{ field: 'cplc', op: 'gt', value: 2500 }],
    }),
    actionSpecJson: JSON.stringify({
      type: 'KILL_ADSET',
      killTier: 'T2',
      renamePrefix: '(KILL)',
      logGraveyard: true,
    }),
    evaluationWindowMinutes: 60,
    cooldownMinutes: 0,
    priority: 2,
  },
]

async function main() {
  const adminUserId = process.env.CPAS_ADMIN_USER_ID
  if (!adminUserId) {
    const admin = await prisma.adminUser.findFirst({ where: { role: 'admin' } })
    if (!admin) throw new Error('No admin user found. Set CPAS_ADMIN_USER_ID env var.')
    process.env.CPAS_ADMIN_USER_ID = admin.id
    console.log(`Using admin user: ${admin.email} (${admin.id})`)
  }

  const userId = process.env.CPAS_ADMIN_USER_ID!

  let created = 0
  let skipped = 0

  for (const rule of CPAS_RULES) {
    const existing = await prisma.automationRule.findFirst({ where: { name: rule.name } })
    if (existing) {
      console.log(`⏭  Skipped (exists): ${rule.name}`)
      skipped++
      continue
    }

    await prisma.automationRule.create({
      data: {
        userId,
        name: rule.name,
        description: rule.description,
        scope: rule.scope,
        ruleCategory: rule.ruleCategory,
        conditionTreeJson: rule.conditionTreeJson,
        actionSpecJson: rule.actionSpecJson,
        evaluationWindowMinutes: rule.evaluationWindowMinutes,
        cooldownMinutes: rule.cooldownMinutes,
        priority: rule.priority,
        status: 'ACTIVE',
      },
    })

    console.log(`✅ Created: ${rule.name}`)
    created++
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
