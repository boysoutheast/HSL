import { canWriteToAdAccount } from '@/lib/write-guard'

async function main() {
  const result = await canWriteToAdAccount(
    'cmpnsfpkb00017vd42rimxd0j', // admin user
    'cmqgbffr9000tzwr857xxx7l6'  // MetaAdAccount id
  )
  console.log('WriteCheck:', JSON.stringify(result, null, 2))
}
main().catch(e => console.error(e.message))
