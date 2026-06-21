import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  await prisma.campaignSession.updateMany({
    where: { id: { in: ['smoke-topup-001', 'cmqkv4q570001ufz8sd8qg9q5'] } },
    data: { nextMonitorAt: new Date('2020-01-01') },
  })
  console.log('Reset OK')
}
main().finally(() => prisma.$disconnect())
