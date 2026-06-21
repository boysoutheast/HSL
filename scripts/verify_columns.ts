import { prisma } from '@/lib/prisma'

async function main() {
  const r = await prisma.$queryRawUnsafe(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'metric_snapshots' AND column_name IN ('cpa', 'frequency')"
  )
  console.log('metric_snapshots columns:', JSON.stringify(r, null, 2))
  
  const r2 = await prisma.$queryRawUnsafe(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'campaign_sessions' AND column_name IN ('insight_window')"
  )
  console.log('campaign_sessions columns:', JSON.stringify(r2, null, 2))
}
main().catch(e => console.error(e.message))
