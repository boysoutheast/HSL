import { readFileSync } from 'fs'

const env = readFileSync('/root/.hermes/.env', 'utf8')
const token = env.split('\n').find(l => l.startsWith('META_TOKEN='))!.slice('META_TOKEN='.length).trim()

console.log('Restoring budget to Rp100,000...')

async function main() {
  const url = 'https://graph.facebook.com/v21.0/120244710362590290'
  
  // POST daily_budget = 100000
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: new URLSearchParams({ daily_budget: '100000' }),
  })
  const data = await resp.json()
  console.log('Restore result:', JSON.stringify(data, null, 2))
  
  // Wait + readback
  await new Promise(r => setTimeout(r, 2000))
  const readback = await fetch(`${url}?fields=id,daily_budget,budget_remaining`, {
    headers: { 'Authorization': `Bearer ${token}` }
  }).then(r => r.json())
  console.log('After restore:', JSON.stringify(readback, null, 2))
  
  const restored = Number(readback.daily_budget) === 100000
  console.log(`Budget restored to Rp100,000: ${restored}`)
}
main().catch(console.error)
