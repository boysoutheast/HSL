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
  console.log('Sessions:', sessions.length)
  for (const s of sessions) {
    console.log(`${s.id} | ${s.name} | metaCampaignId=${s.metaCampaignId} | adAccount=${JSON.stringify(s.metaAdAccount)} | entities=${s.metaEntities?.length ?? 0} | rules=${s.automationRules.length}`)
  }
}
main().catch(e => console.error(e.message))
