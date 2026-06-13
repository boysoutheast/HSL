const run = async () => {
  const BASE = 'http://localhost:3000'

  // 1. Call webhook — completed
  console.log('=== 1. WEBHOOK COMPLETED ===')
  const whRes = await fetch(BASE + '/api/hermes/generate/video/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': '***'
    },
    body: JSON.stringify({
      externalJobId: 'smoke-ext-001',
      status: 'completed',
      videoUrl: 'https://cdn.example.com/smoke-test.mp4',
      durationSeconds: 10
    })
  })
  console.log('Webhook status:', whRes.status)
  const wh = await whRes.json()
  console.log(JSON.stringify(wh, null, 2))

  // 2. Check media status
  console.log('\n=== 2. GENERATED MEDIA STATUS ===')
  const API_KEY=*** *'
  const mediaRes = await fetch(BASE + '/api/hermes/generated-media/493503e1-0acf-45e5-82ce-e4e6627d7a8c', {
    headers: { Authorization: 'Bearer ' + API_KEY }
  })
  console.log('Media status:', mediaRes.status)
  const media = await mediaRes.json()
  console.log(JSON.stringify(media, null, 2))

  // 3. Check balance — should be unchanged (no refund on completed)
  console.log('\n=== 3. FINAL BALANCE ===')
  const balRes = await fetch(BASE + '/api/hermes/credits', {
    headers: { Authorization: 'Bearer ' + API_KEY }
  })
  const bal = await balRes.json()
  console.log('Balance:', bal.balance)
  console.log('Transactions:', bal.total)
}

run().catch(e => console.error('ERROR:', e.message))
