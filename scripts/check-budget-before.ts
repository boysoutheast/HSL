import { readFileSync } from 'fs'
import https from 'https'

const env = readFileSync('/root/.hermes/.env', 'utf8')
const token = env.split('\n').find(l => l.startsWith('META_TOKEN='))!.slice('META_TOKEN='.length).trim()trim()

console.log('BEFORE SCAN — checking budget...')
https.get(`https://graph.facebook.com/v21.0/120244710362590290?fields=id,name,daily_budget,budget_remaining,status&access_token=${token}`, (res) => {
  let d = ''
  res.on('data', (c: string) => d += c)
  res.on('end', () => {
    const data = JSON.parse(d)
    console.log(`Campaign: ${data.name}`)
    console.log(`Daily Budget: Rp${parseInt(data.daily_budget || '0').toLocaleString()}`)
    console.log(`Budget Remaining: Rp${parseInt(data.budget_remaining || '0').toLocaleString()}`)
    console.log(`Status: ${data.status}`)
  })
}).end()
