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
      op: 'AND',
      children: [
        { metric: 'roas', operator: 'gt', value: 2 },
        { metric: 'spend', operator: 'gt', value: 50000 },
      ],
    }),
    actionSpecJson: JSON.stringify({
      actionType: 'UPDATE_BUDGET',
      mode: 'increase_pct',
      amount: 20,
    }),
  },
  {
    name: '🛑 Kill Loser',
    description: 'Matikan adset kalau udah habis banyak tapi gak ada pembelian. Hemat budget.',
    scope: 'ADSET',
    ruleCategory: 'THRESHOLD',
    conditionTreeJson: JSON.stringify({
      op: 'AND',
      children: [
        { metric: 'spend', operator: 'gt', value: 100000 },
        { metric: 'purchases', operator: 'eq', value: 0 },
      ],
    }),
    actionSpecJson: JSON.stringify({
      actionType: 'PAUSE',
    }),
  },
  {
    name: '📉 Turun Budget Boros',
    description: 'Kurangi budget kalau CPC mahal dan ROAS jelek. Daripada boncos terus.',
    scope: 'ADSET',
    ruleCategory: 'THRESHOLD',
    conditionTreeJson: JSON.stringify({
      op: 'AND',
      children: [
        { metric: 'cpc', operator: 'gt', value: 5000 },
        { metric: 'roas', operator: 'lt', value: 1 },
      ],
    }),
    actionSpecJson: JSON.stringify({
      actionType: 'UPDATE_BUDGET',
      mode: 'decrease_pct',
      amount: 20,
    }),
  },
  {
    name: '⏸️ Pause CTR Jelek',
    description: 'Matikan adset kalau orang gak ngeklik iklan padahal udah dilihat banyak. Kreatif/audience perlu ganti.',
    scope: 'ADSET',
    ruleCategory: 'THRESHOLD',
    conditionTreeJson: JSON.stringify({
      op: 'AND',
      children: [
        { metric: 'ctr', operator: 'lt', value: 1 },
        { metric: 'impressions', operator: 'gt', value: 5000 },
      ],
    }),
    actionSpecJson: JSON.stringify({
      actionType: 'PAUSE',
    }),
  },
  {
    name: '🔥 Scale Agresif',
    description: 'Naikkan budget lebih agresif kalau ROAS tinggi banget. Gas terus selagi panas.',
    scope: 'ADSET',
    ruleCategory: 'THRESHOLD',
    conditionTreeJson: JSON.stringify({
      op: 'AND',
      children: [
        { metric: 'roas', operator: 'gt', value: 4 },
      ],
    }),
    actionSpecJson: JSON.stringify({
      actionType: 'UPDATE_BUDGET',
      mode: 'increase_pct',
      amount: 30,
    }),
  },
  {
    name: '💤 Pause Tidur',
    description: 'Matikan adset kalau udah bayar tapi gak ada yang liat. Mungkin audience jenuh atau gambar jelek.',
    scope: 'ADSET',
    ruleCategory: 'THRESHOLD',
    conditionTreeJson: JSON.stringify({
      op: 'AND',
      children: [
        { metric: 'spend', operator: 'gt', value: 50000 },
        { metric: 'impressions', operator: 'lt', value: 500 },
      ],
    }),
    actionSpecJson: JSON.stringify({
      actionType: 'PAUSE',
    }),
  },
  // ── PR-2: Research-aligned templates (Fase 6) ──
  {
    name: '📈 Scale Winner (Vertical 20%)',
    description: 'Naikkan budget 20% kalau ROAS ≥1.5x, minimal 5 purchase, dan campaign udah jalan ≥7 hari. Cooldown 48 jam biar gak naik terlalu sering.',
    scope: 'ADSET',
    ruleCategory: 'THRESHOLD',
    conditionTreeJson: JSON.stringify({
      op: 'AND',
      children: [
        { metric: 'roas', operator: 'gte', value: 1.5 },
        { metric: 'purchases', operator: 'gte', value: 5 },
        { metric: 'adset_age_days', operator: 'gte', value: 7 },
      ],
    }),
    actionSpecJson: JSON.stringify({
      actionType: 'UPDATE_BUDGET',
      mode: 'increase_pct',
      amount: 20,
      cooldownMinutes: 2880,
    }),
  },
  {
    name: '🔋 Fatigue Guard',
    description: 'Turunkan budget 20% kalau frequency iklan >3.5x. Frequency tinggi = audience udah bosen.',
    scope: 'ADSET',
    ruleCategory: 'THRESHOLD',
    conditionTreeJson: JSON.stringify({
      children: [
        { metric: 'frequency', operator: 'gt', value: 3.5 },
      ],
    }),
    actionSpecJson: JSON.stringify({
      actionType: 'UPDATE_BUDGET',
      mode: 'decrease_pct',
      amount: 20,
    }),
  },
  {
    name: '✅ Scale-Ready Gate (TARACARE)',
    description: 'Notifikasi kalau campaign siap di-scale: ROAS stabil ≥1.5x 7 hari, frequency <3.5x, CPA stabil naik <20%. Cocok buat TARACARE body care.',
    scope: 'CAMPAIGN',
    ruleCategory: 'THRESHOLD',
    conditionTreeJson: JSON.stringify({
      op: 'AND',
      children: [
        { metric: 'roas_min_7d', operator: 'gte', value: 1.5 },
        { metric: 'purchases', operator: 'gte', value: 5 },
        { metric: 'frequency', operator: 'lt', value: 3.5 },
        { metric: 'cpa_change_pct_3d', operator: 'lte', value: 20 },
      ],
    }),
    actionSpecJson: JSON.stringify({
      actionType: 'NOTIFY',
      title: 'Campaign siap di-scale',
      body: 'Semua gate terpenuhi: ROAS sustain, frequency rendah, CPA stabil.',
    }),
  },
  {
    name: '🪓 Kill Loser (Screening)',
    description: 'Matikan adset screening yang udah keluar Rp10.000+ tapi belum ada pembelian. Cocok buat fase testing awal.',
    scope: 'ADSET',
    ruleCategory: 'THRESHOLD',
    conditionTreeJson: JSON.stringify({
      op: 'AND',
      children: [
        { metric: 'spend', operator: 'gt', value: 10000 },
        { metric: 'purchases', operator: 'eq', value: 0 },
      ],
    }),
    actionSpecJson: JSON.stringify({
      actionType: 'PAUSE',
    }),
  },
  {
    name: '💰 Kill Boros (ROAS <1)',
    description: 'Matikan adset kalau udah spend Rp30K+ tapi ROAS di bawah 1x. Daripada boncos terus.',
    scope: 'ADSET',
    ruleCategory: 'THRESHOLD',
    conditionTreeJson: JSON.stringify({
      op: 'AND',
      children: [
        { metric: 'spend', operator: 'gt', value: 30000 },
        { metric: 'roas', operator: 'lt', value: 1 },
      ],
    }),
    actionSpecJson: JSON.stringify({
      actionType: 'PAUSE',
    }),
  },
  {
    name: '🧪 Scale Test Winner',
    description: 'Naikkan budget 30% ke adset pemenang kalau test A/B sudah menghasilkan winner. Otomatis pause variant kalah.',
    scope: 'ADSET',
    ruleCategory: 'COMPOSITE',
    conditionTreeJson: JSON.stringify({
      type: 'TEST_OUTCOME',
      adTestId: '',
      expect: 'WINNER_DECLARED',
    }),
    actionSpecJson: JSON.stringify({
      actionType: 'UPDATE_BUDGET',
      mode: 'increase_pct',
      amount: 30,
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
