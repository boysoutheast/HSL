import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Find ANY MetaEntity for the session's campaign
  const entity = await prisma.metaEntity.findFirst({ select: { id: true, metaEntityId: true } })
  console.log('Any entity:', JSON.stringify(entity))
  
  if (entity) {
    const now = new Date()
    const windowEnd = new Date(now); windowEnd.setMinutes(0, 0, 0)
    
    // Upsert (same as scan-campaigns code)
    const upserted = await prisma.metricSnapshot.upsert({
      where: {
        campaignSessionId_metaEntityId_windowEnd: {
          campaignSessionId: 'smoke-topup-001',
          metaEntityId: entity.id,
          windowEnd,
        },
      },
      update: { spend: 50000, roas: 6.0, frequency: 2.5, purchases: 3, cpa: 16667, cpc: 1000, ctr: 2.5 },
      create: {
        userId: 'cmpnsfpkb00017vd42rimxd0j',
        campaignSessionId: 'smoke-topup-001',
        metaEntityId: entity.id,
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
        frequency: 2.5,
        cpa: 16667,
        cpc: 1000,
        ctr: 2.5,
      },
    })
    console.log('Upserted:', upserted.id, 'cpa:', upserted.cpa, 'frequency:', upserted.frequency)
    
    // Cleanup
    await prisma.metricSnapshot.delete({ where: { id: upserted.id } })
    console.log('Cleaned')
  }
}
main().finally(() => prisma.$disconnect())
