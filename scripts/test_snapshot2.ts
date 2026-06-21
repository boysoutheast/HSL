import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Find MetaEntities for the smoke campaign session
  const entities = await prisma.metaEntity.findMany({
    where: { campaignSessionId: 'smoke-topup-001' },
    take: 5,
    select: { id: true, metaEntityId: true, entityType: true, name: true },
  })
  console.log('Entities:', JSON.stringify(entities, null, 2))
  
  if (entities.length > 0) {
    const me = entities[0]
    // Insert a test snapshot with cpa + frequency using real metaEntity
    const now = new Date()
    const windowEnd = new Date(now); windowEnd.setMinutes(0, 0, 0)
    const inserted = await prisma.metricSnapshot.create({
      data: {
        userId: 'cmpnsfpkb00017vd42rimxd0j',
        campaignSessionId: 'smoke-topup-001',
        metaEntityId: me.id,
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
    console.log('Inserted ID:', inserted.id)
    console.log('cpa:', inserted.cpa, 'frequency:', inserted.frequency)
    
    // Readback
    const readback = await prisma.metricSnapshot.findUnique({
      where: { id: inserted.id },
      select: { id: true, spend: true, cpa: true, frequency: true, purchases: true, roas: true },
    })
    console.log('Readback:', JSON.stringify(readback))
    
    // Cleanup
    await prisma.metricSnapshot.delete({ where: { id: inserted.id } })
    console.log('Cleaned up')
  }
}
main().finally(() => prisma.$disconnect())
