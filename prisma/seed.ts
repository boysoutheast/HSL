import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ── Built-in Rule Templates ──────────────────────────────────────────────

interface TemplateDef {
  name: string
  description: string
  scope: string
  ruleCategory: string
  conditionTreeJson: string
  actionSpecJson: string
}

const BUILTIN_TEMPLATES: TemplateDef[] = [
  {
    name: '🚀 Scale Winner',
    description: 'Naikkan budget otomatis kalau ROAS bagus dan udah keluar biaya. Cocok buat adset yang lagi perform.',
    scope: 'ADSET',
    ruleCategory: 'THRESHOLD',
    conditionTreeJson: JSON.stringify({
      operator: 'AND',
      conditions: [
        { metric: 'roas', operator: '>', value: 2, type: 'number' },
        { metric: 'spend', operator: '>', value: 50000, type: 'number' },
      ],
    }),
    actionSpecJson: JSON.stringify({
      action: 'update_budget',
      params: { percentage: 20 },
    }),
  },
  {
    name: '🛑 Kill Loser',
    description: 'Matikan adset kalau udah habis banyak tapi gak ada pembelian. Hemat budget.',
    scope: 'ADSET',
    ruleCategory: 'THRESHOLD',
    conditionTreeJson: JSON.stringify({
      operator: 'AND',
      conditions: [
        { metric: 'spend', operator: '>', value: 100000, type: 'number' },
        { metric: 'purchases', operator: '==', value: 0, type: 'number' },
      ],
    }),
    actionSpecJson: JSON.stringify({
      action: 'pause_adset',
      params: {},
    }),
  },
  {
    name: '📉 Turun Budget Boros',
    description: 'Kurangi budget kalau CPC mahal dan ROAS jelek. Daripada boncos terus.',
    scope: 'ADSET',
    ruleCategory: 'THRESHOLD',
    conditionTreeJson: JSON.stringify({
      operator: 'AND',
      conditions: [
        { metric: 'cpc', operator: '>', value: 5000, type: 'number' },
        { metric: 'roas', operator: '<', value: 1, type: 'number' },
      ],
    }),
    actionSpecJson: JSON.stringify({
      action: 'update_budget',
      params: { percentage: -20 },
    }),
  },
  {
    name: '⏸️ Pause CTR Jelek',
    description: 'Matikan adset kalau orang gak ngeklik iklan padahal udah dilihat banyak. Kreatif/audience perlu ganti.',
    scope: 'ADSET',
    ruleCategory: 'THRESHOLD',
    conditionTreeJson: JSON.stringify({
      operator: 'AND',
      conditions: [
        { metric: 'ctr', operator: '<', value: 1, type: 'number' },
        { metric: 'impressions', operator: '>', value: 5000, type: 'number' },
      ],
    }),
    actionSpecJson: JSON.stringify({
      action: 'pause_adset',
      params: {},
    }),
  },
  {
    name: '🔥 Scale Agresif',
    description: 'Naikkan budget lebih agresif kalau ROAS tinggi banget. Gas terus selagi panas.',
    scope: 'ADSET',
    ruleCategory: 'THRESHOLD',
    conditionTreeJson: JSON.stringify({
      operator: 'AND',
      conditions: [
        { metric: 'roas', operator: '>', value: 4, type: 'number' },
      ],
    }),
    actionSpecJson: JSON.stringify({
      action: 'update_budget',
      params: { percentage: 30 },
    }),
  },
  {
    name: '💤 Pause Tidur',
    description: 'Matikan adset kalau udah bayar tapi gak ada yang liat. Mungkin audience jenuh atau gambar jelek.',
    scope: 'ADSET',
    ruleCategory: 'THRESHOLD',
    conditionTreeJson: JSON.stringify({
      operator: 'AND',
      conditions: [
        { metric: 'spend', operator: '>', value: 50000, type: 'number' },
        { metric: 'impressions', operator: '<', value: 500, type: 'number' },
      ],
    }),
    actionSpecJson: JSON.stringify({
      action: 'pause_adset',
      params: {},
    }),
  },
]

async function seedBuiltinTemplates() {
  for (const tpl of BUILTIN_TEMPLATES) {
    // Idempotent upsert by name + isBuiltin=true + userId=null
    const existing = await prisma.ruleTemplate.findFirst({
      where: { name: tpl.name, isBuiltin: true, userId: null },
    })
    if (existing) {
      console.log(`  Built-in template "${tpl.name}" already exists, skipping`)
      continue
    }
    await prisma.ruleTemplate.create({
      data: {
        name: tpl.name,
        description: tpl.description,
        scope: tpl.scope,
        ruleCategory: tpl.ruleCategory,
        conditionTreeJson: tpl.conditionTreeJson,
        actionSpecJson: tpl.actionSpecJson,
        isBuiltin: true,
        userId: null,
        usageCount: 0,
      },
    })
    console.log(`  Created built-in template "${tpl.name}"`)
  }
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding database...')

  // Seed default PostingMonitorSetting
  const existingSettings = await prisma.postingMonitorSetting.findFirst()
  if (!existingSettings) {
    await prisma.postingMonitorSetting.create({
      data: {
        checkIntervalMinutes: 60,
        minimumDecisionAgeMinutes: 180,
        deadEarlyAgeMinutes: 120,
        stuckThresholdPercentPerHour: 3,
        growingThresholdPercentPerHour: 10,
        hotThresholdPercentPerHour: 20,
        stuckConfirmationCount: 2,
        hotLockDurationMinutes: 360,
        maxPostPerDay: 2,
        minimumGapUploadMinutes: 360,
      },
    })
    console.log('Created default PostingMonitorSetting')
  } else {
    console.log('PostingMonitorSetting already exists, skipping')
  }

  // Seed default admin user
  const existingAdmin = await prisma.adminUser.findUnique({
    where: { email: 'admin@hermes.local' },
  })

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('hermes123', 12)
    await prisma.adminUser.create({
      data: {
        email: 'admin@hermes.local',
        passwordHash,
        name: 'Hermes Admin',
        role: 'admin',
      },
    })
    console.log('Created admin user: admin@hermes.local / hermes123')
  } else {
    console.log('Admin user already exists, skipping')
  }

  // Seed built-in rule templates (idempotent)
  console.log('Seeding built-in rule templates...')
  await seedBuiltinTemplates()

  console.log('Seeding complete.')
}

main()
  .catch(e => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
