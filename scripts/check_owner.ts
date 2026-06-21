import { prisma } from '@/lib/prisma'

async function main() {
  // Find MetaAdAccount for 502503321797826
  const adAcc = await prisma.metaAdAccount.findFirst({
    where: { adAccountId: '502503321797826' },
    select: { id: true, adAccountId: true, metaAccount: { select: { id: true, userId: true, status: true, tokenExpiry: true, longLivedTokenEncrypted: true } } }
  })
  console.log('AdAccount:', JSON.stringify(adAcc, null, 2))
  
  // The session user
  const user = await prisma.adminUser.findUnique({ where: { id: 'cmpnsfpkb00017vd42rimxd0j' }, select: { id: true, email: true } })
  console.log('User:', JSON.stringify(user, null, 2))
}
main().catch(e => console.error(e.message))
