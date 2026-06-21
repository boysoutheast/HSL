import { prisma } from '@/lib/prisma'

async function main() {
  const sessions = await prisma.campaignSession.findMany({
    where: { status: 'RUNNING' },
    select: { id: true, name: true, automationEnabled: true, nextMonitorAt: true },
  })
  console.log(JSON.stringify(sessions, null, 2))
}
main().catch(e => console.error(e.message))
