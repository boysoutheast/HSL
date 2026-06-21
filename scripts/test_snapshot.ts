import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // 1. Check existing snapshots
  const snap = await prisma.metricSnapshot.findFirst({
    where: { campaignSessionId: 'smoke-topup-001' },
    orderBy: { windowEnd: 'desc' },
  })
  console.log('Existing:', JSON.stringify(snap, (k, v) => v instanceof Date ? v.toISOString() : v, 2))
  
  // 2. Insert a test snapshot with cpa + frequency
  const now = new Date()
  const windowEnd = new Date(now); windowEnd.setMinutes(0, 0, 0)
  const inserted = await prisma.metricSnapshot.create({
    data: {
      userId: 'cmpnsfpkb00017vd42rimxd0j',
      campaignSessionId: 'smoke-topup-001',
      metaEntityId: 'cmqgbffr9000tzwr857xxx7l6',
      entityType: 'CAMPAIGN',
      windowStart: windowEnd,
      windowEnd,
      attributionWindow: 'smoke_test',
      spend: 50000,
      impressions: 2000,
      clicks: 50,
      purchases: 3,
      purchaseValue: 300000,
      roas: 6.0,
      cpa: 16667,
      frequency: 2.5,
      cpc: 1000,
      ctr: 2.5,
    },
  })
  console.log('Inserted:', inserted.id, 'cpa=', inserted.cpa, 'frequency=', inserted.frequency)
  
  // 3. Verify readback
  const readback = await prisma.metricSnapshot.findUnique({
    where: { id: inserted.id },
    select: { id: true, spend: true, roas: true, cpa: true, frequency: true, purchases: true, cpc: true },
  })
  console.log('Readback:', JSON.stringify(readback))
  
  // Cleanup test row
  await prisma.metricSnapshot.delete({ where: { id: inserted.id } })
  console.log('Cleaned up')
}
main().finally(() => prisma.$disconnect())
