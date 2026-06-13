const run = async () => {
  const API_KEY='hs_a0b5951ef2de0f1738b78f75319675281aa45fe94c17bb17b4a824b799dc2cfb'
  const BASE = 'http://localhost:3000'

  console.log('=== 1. CHECK BALANCE ===')
  const balRes = await fetch(BASE + '/api/hermes/credits', {
    headers: { Authorization: 'Bearer ' + API_KEY }
  })
  console.log('Credits status:', balRes.status)
  const bal = await balRes.json()
  console.log(JSON.stringify(bal, null, 2))

  console.log('\n=== 2. GENERATE VIDEO ===')
  const genRes = await fetch(BASE + '/api/hermes/generate/video', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: 'A beautiful sunset over mountains, cinematic quality, 4K'
    })
  })
  console.log('Generate status:', genRes.status)
  const gen = await genRes.json()
  console.log(JSON.stringify(gen, null, 2))

  console.log('\n=== 3. BALANCE AFTER ===')
  const bal2Res = await fetch(BASE + '/api/hermes/credits', {
    headers: { Authorization: 'Bearer ' + API_KEY }
  })
  console.log('Credits-after status:', bal2Res.status)
  const bal2 = await bal2Res.json()
  console.log(JSON.stringify(bal2, null, 2))

  if (gen.mediaId) {
    console.log('\n=== 4. CHECK MEDIA ===')
    const mediaRes = await fetch(BASE + '/api/hermes/generated-media/' + gen.mediaId, {
      headers: { Authorization: 'Bearer ' + API_KEY }
    })
    console.log('Media status:', mediaRes.status)
    const media = await mediaRes.json()
    console.log(JSON.stringify(media, null, 2))
  }
}

run().catch(e => console.error('ERROR:', e))
