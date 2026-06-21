import { getInsights } from '@/lib/meta-client'
import { canWriteToAdAccount } from '@/lib/write-guard'

async function main() {
  const wc = await canWriteToAdAccount('cmpnsfpkb00017vd42rimxd0j', 'cmqgbffr9000tzwr857xxx7l6')
  if (!wc.ok) { console.log('WRITE GUARD FAIL:', wc.reason); return }
  
  const insights = await getInsights('120244643089020290', wc.token!, 'maximum')
  console.log('Insights:', JSON.stringify(insights, null, 2))
  console.log('Has frequency:', insights.frequency !== null)
  console.log('Has cpa:', insights.purchases > 0 ? 'YES (paid insights)' : 'NO DATA (no purchases yet)')
}
main().catch(e => console.error(e.message))
