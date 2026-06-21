import { canWriteToAdAccount } from '@/lib/write-guard'

async function main() {
  // Test both sessions
  const tests = [
    { userId: 'cmpnsfpkb00017vd42rimxd0j', adAccountId: 'cmqgbffr9000tzwr857xxx7l6', label: 'smoke-topup-001' },
    { userId: 'cmpnsfpkb00017vd42rimxd0j', adAccountId: 'cmqgbffr9000tzwr857xxx7l6', label: 'smoke-001' },
  ]
  for (const t of tests) {
    const result = await canWriteToAdAccount(t.userId, t.adAccountId)
    console.log(`${t.label}: ok=${result.ok} reason=${result.reason || '-'}`)
  }
}
main().catch(e => console.error(e.message))
