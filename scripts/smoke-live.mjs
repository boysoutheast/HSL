// Test live API directly
const fs = require('fs')
const content = fs.readFileSync('/root/hsl-source/scripts/smoke-test.mjs', 'utf8')
const match = content.match(/const API_KEY='***'/)
const API_KEY = match ? match[1] : null

if (!API_KEY) { console.error('No key found'); process.exit(1) }

async function main() {
  const BASE = 'https://ai.boytenggara.com'

  // 1. Check credits
  console.log('=== CREDITS ===')
  let res = await fetch(BASE + '/api/hermes/credits', {
    headers: { Authorization: 'Bearer ' + API_KEY }
  })
  const bal = await res.json()
  console.log('Status:', res.status, 'Balance:', bal.balance)

  // 2. Check generated media
  console.log('\n=== MEDIA ===')
  res = await fetch(BASE + '/api/hermes/generated-media/493503e1-0acf-45e5-82ce-e4e6627d7a8c', {
    headers: { Authorization: 'Bearer ' + API_KEY }
  })
  const media = await res.json()
  console.log('Status:', res.status, media.status, media.videoUrl || media.error)

  // 3. Generate new video
  console.log('\n=== GENERATE ===')
  res = await fetch(BASE + '/api/hermes/generate/video', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt: 'Smoke test from live app - sunset beach cinematic' })
  })
  const gen = await res.json()
  console.log('Status:', res.status)
  console.log(JSON.stringify(gen, null, 2))

  // 4. Balance after generate
  console.log('\n=== BALANCE AFTER ===')
  res = await fetch(BASE + '/api/hermes/credits', {
    headers: { Authorization: 'Bearer ' + API_KEY }
  })
  const bal2 = await res.json()
  console.log('Status:', res.status, 'Balance:', bal2.balance)
}

main().catch(e => console.error('ERROR:', e.message))
