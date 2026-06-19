import { PrismaClient } from '@prisma/client'
import { encode, decode } from '@/lib/crypto'
import { readFileSync } from 'fs'

const prisma = new PrismaClient()

async function main() {
  // Read the actual token
  const token = readFileSync('/tmp/meta_token.txt', 'utf8').trim()
  console.log('Token length:', token.length)
  
  // Re-encrypt with local key
  const reEncoded = encode(token)
  console.log('Re-encoded (local key) length:', reEncoded.length)
  
  // Verify it works
  const verify = decode(reEncoded)
  console.log('Verify OK:', verify === token)
  
  // Find the MetaAccount
  const adAccount = await prisma.metaAdAccount.findFirst({
    where: { adAccountId: '502503321797826' },
    select: { id: true, metaAccount: { select: { id: true } } }
  })
  if (!adAccount) { console.log('NO AD ACCOUNT'); return }
  
  // Update with re-encrypted token
  await prisma.metaAccount.update({
    where: { id: adAccount.metaAccount.id },
    data: { longLivedTokenEncrypted: reEncoded }
  })
  console.log('✅ Token re-encrypted with LOCAL key')
  
  await prisma.$disconnect()
}
main()
