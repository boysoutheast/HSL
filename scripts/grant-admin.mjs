import '../src/lib/polyfills-node.mjs'
import { grantCredits, getBalance } from '../src/lib/credits.ts'

const ADMIN_ID = 'cmpnsfpkb00017vd42rimxd0j'

try {
  const before = await getBalance(ADMIN_ID)
  console.log('Before:', before)

  const result = await grantCredits(ADMIN_ID, 13000, 'smoke_test_grant', 'smoke_2026-06-13_01')
  console.log('After:', result.balanceAfter)
  console.log('Txn ID:', result.transactionId)

  const verify = await getBalance(ADMIN_ID)
  console.log('Verify:', verify)
} catch (err) {
  console.error('FAIL:', err)
  process.exit(1)
}
