import { PrismaClient } from '@prisma/client'
import { encode, decode } from '@/lib/crypto'
import { readFileSync } from 'fs'

const prisma = new PrismaClient()

async function main() {
  // Read the actual token from Hermes env
  const tokenLine = readFileSync('/root/.hermes/.env', 'utf8')
    .split('\n')
    .find(l => l.startsWith('META_TOKEN='))
  if (!tokenLine) { console.log('NO TOKEN FOUND'); process.exit(1) }
  
  const token = tokenLine.split('=').slice(1).join('=').trim()
  console.log('Token prefix:', token.slice(0, 20))

  // Encode with local ENCRYPTION_KEY
  const encoded = encode(token)
  console.log('Encoded length:', encoded.length)

  // Verify decode works
  const verify = decode(encoded)
  console.log('Verify OK:', verify === token)

  // Find MetaAccount for ad account 502503321797826
  const acct = await prisma.metaAccount.findFirst({
    where: { adAccounts: { some: { adAccountId: '502503321797826' } } }
  })
  if (!acct) { console.log('NO META ACCOUNT FOUND'); process.exit(1) }
  console.log('MetaAccount id:', acct.id)

  // Update with encoded token + status
  await prisma.metaAccount.update({
    where: { id: acct.id },
    data: { 
      longLivedTokenEncrypted: encoded,
      status: 'connected',
    }
  })
  console.log('✅ Token saved + status=connected')

  // Verify
  const check = await prisma.metaAccount.findUnique({ where: { id: acct.id } })
  console.log('Has token:', !!check!.longLivedTokenEncrypted)
  console.log('Status:', check!.status)

  await prisma.$disconnect()
  console.log('DONE')
}
main().catch(e => { console.error(e); process.exit(1) })
