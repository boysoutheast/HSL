import { prisma } from '@/lib/prisma'

async function main() {
  const now = new Date()
  const sessions = await prisma.campaignSession.findMany({
    where: {
      status: 'RUNNING',
      automationEnabled: true,
      OR: [{ nextMonitorAt: { lte: now } }, { nextMonitorAt: null }],
    },
    take: 30,
    orderBy: { nextMonitorAt: { sort: 'asc', nulls: 'first' } },
    select: {
      id: true,
      userId: true,
      metaCampaignId: true,
      dailyBudget: true,
      budgetMode: true,
      primaryAdsetMetaId: true,
      monitorIntervalMinutes: true,
      insightWindow: true,
      metaAdAccount: { select: { id: true, adAccountId: true } },
      metaEntities: { where: { entityType: 'CAMPAIGN' }, take: 1, select: { id: true, metaEntityId: true } },
      automationRules: { where: { status: 'ACTIVE' }, orderBy: { priority: 'asc' } },
    },
  })
  console.log('Found:', sessions.length)
  for (const s of sessions) {
    const ma = s.metaAdAccount
    console.log(`id=${s.id} | userId=${s.userId} | mCampaignId=${s.metaCampaignId} | ma=${ma ? ma.id : 'NULL'} | entities=${s.metaEntities?.length ?? 0} | rules=${s.automationRules.length}`)
  }
  
  if (sessions.length === 0) {
    // Try without OR
    const all = await prisma.campaignSession.findMany({
      where: { status: 'RUNNING', automationEnabled: true },
      select: { id: true, name: true, nextMonitorAt: true },
    })
    console.log('All RUNNING+enabled:', all.length)
    for (const s of all) {
      console.log(`  ${s.id} | ${s.name} | next=${s.nextMonitorAt}`)
    }
  }
}
main().catch(e => console.error(e.message))
