const BASE = 'http://localhost:3000'
const WEBHOOK_SECRET = 'smoke-test-secret-2026'
const MEDIA_ID = '493503e1-0acf-45e5-82ce-e4e6627d7a8c'
const API_KEY = 'hs_a0b5951ef2de0f1738b78f75319675281aa45fe94c17bb17b4a824b799dc2cfb'

async function main() {
  // 1. Webhook: completed
  console.log('=== 1. WEBHOOK ===')
  let res = await fetch(BASE + '/api/hermes/generate/video/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': WEBHOOK_SECRET
    },
    body: JSON.stringify({
      externalJobId: 'smoke-ext-001',
      status: 'completed',
      videoUrl: 'https://cdn.example.com/smoke-test.mp4',
      durationSeconds: 10
    })
  })
  const whBody = await res.json()
  console.log('Status:', res.status, JSON.stringify(whBody))

  // 2. Media detail
  console.log('\n=== 2. MEDIA ===')
  res = await fetch(BASE + '/api/hermes/generated-media/' + MEDIA_ID, {
    headers: { Authorization: 'Bearer ' + API_KEY }
  })
  const media = await res.json()
  console.log('Status:', media.status)
  console.log('videoUrl:', media.videoUrl)
  console.log('completedAt:', media.completedAt)

  // 3. Balance
  console.log('\n=== 3. BALANCE ===')
  res = await fetch(BASE + '/api/hermes/credits', {
    headers: { Authorization: 'Bearer ' + API_KEY }
  })
  const bal = await res.json()
  console.log('Balance:', bal.balance, '| txns:', bal.total)
}

main().catch(e => console.error('ERROR:', e.message))
