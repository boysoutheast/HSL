import { readFileSync } from 'fs'
import https from 'https'

const env = readFileSync('/root/.hermes/.env', 'utf8')
const token = env.split('\n').find(l => l.startsWith('META_TOKEN='***token.split('=').slice(1).join('=').trim()

https.get(`https://graph.facebook.com/v21.0/120244710362590290/adsets?fields=id,name,daily_budget,status&limit=5&access_token=${token}`, (res) => {
  let d = ''
  res.on('data', (c: string) => d += c)
  res.on('end', () => console.log(JSON.stringify(JSON.parse(d), null, 2)))
}).end()
