import { prisma } from '@/lib/prisma'

async function main() {
  const wg = await prisma.writeGuard.findMany({ take: 3 })
  console.log('WriteGuards:', JSON.stringify(wg, null, 2))

  const conns = await prisma.metaConnection.findMany({ take: 3, select: { id: true, userId: true, accountId: true, status: true } })
  console.log('Conns:', JSON.stringify(conns, null, 2))
  
  // Check MetaAccount (not metaAccount)
  const accounts = await prisma.metaAdAccount.findMany({ take: 3 })
  console.log('AdAccounts:', JSON.stringify(accounts.map(a => ({ id: a.id, adAccountId: a.adAccountId })), null, 2))
}
main().catch(e => console.error(e.message))
