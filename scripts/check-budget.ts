import fetch from 'node-fetch'
import { readFileSync } from 'fs'

const env = readFileSync('/root/.hermes/.env', 'utf8')
const tokenLine = env.split('\n').find(l => l.startsWith('META_TOKEN='))
const token = tokenLine!.split('=').slice(1).join('=').trim()

async function main() {
  const url = 'https://graph.facebook.com/v21.0/120244643089020290?fields=id,name,daily_budget,lifetime_budget,budget_remaining,status,adsets{id,name,daily_budget,status}'
  const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
  const data = await resp.json() as any
  console.log(JSON.stringify(data, null, 2))
}
main().catch(e => console.error(e.message))
