# Blueprint: MediaRules Rewire — Direct API Generation (no worker)

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION
**Auditor:** Fable 5 · **Executor:** Sonnet (VPS)
**Estimasi:** 30–45 menit

> Konteks: worker mati. `cron/media-rules` dulu enqueue WorkerTask buat worker generate
> media. Sekarang di-rewire: generate LANGSUNG via GeminiGen (pola sama persis dengan
> `/api/gen/video`), tanpa worker. cron-poll-geminigen-fix (`*/5`) tetap nge-poll hasilnya.

---

## Pola referensi: `/api/gen/video` POST (sudah jalan, tiru ini)
Flow direct generation (TANPA worker):
1. Hitung `creditsCost` (SD 6s=1000, SD 10s=1300, HD=2×).
2. `$transaction`: decrement `adminUser.creditBalance`, create `generatedMedia` (status `queued`, model `geminigen`, mediaType VIDEO, simpan orientation/resolution/durationSeconds/creditsCost/clientRef), create `creditTransaction` (amount negatif, reason, refId=gm.id, idempotencyKey) + `generateTxHash`.
3. Di luar transaction: `submitVideoJob({ prompt, aspectRatio, durationSeconds, imageBuffer, imageFilename })` dari `@/lib/geminigen` → dapat `externalJobId` → update gm `{ externalJobId, status:'processing' }`.
4. Kalau submit gagal: set gm `status:'failed'` + refund credit (increment balance).
5. cron-poll-geminigen poll `externalJobId` → set `completed` + videoUrl + mediaHash.

---

## TASK: rewire `src/app/api/cron/media-rules/route.ts`

Baca file dulu. Saat ini di blok `actionType === 'CREATE_TASK'` ada `[DECOMMISSIONED]` `console.info` (enqueue di-skip). Ganti blok itu dengan **direct generation**.

### Data yang tersedia (MediaLibraryRule schema)
- `rule.userId` — **owner, sumber credit** (deduct dari sini)
- `rule.productId` / `rule.characterId` — scope (sumber reference photo)
- `rule.mediaType` — `VIDEO` | `IMAGE`
- `rule.taskType` — `GENERATE_VIDEO` | `GENERATE_PHOTO` | ...
- `rule.taskPayloadJson` — JSON string, **sumber prompt + param** (parse: `{ prompt?, orientation?, resolution?, durationSeconds? }`)
- TIDAK ada field `prompt` langsung — ambil dari `taskPayloadJson.prompt`.

### Langkah implementasi (ganti blok [DECOMMISSIONED])

```ts
// 0. HANYA handle VIDEO dulu. Kalau rule.mediaType !== 'VIDEO' → skip + log "photo gen belum didukung direct" (DEFERRED).
if (rule.mediaType !== 'VIDEO') {
  console.info(`[media-rules] rule=${rule.id} mediaType=${rule.mediaType} belum didukung direct-gen, skip`)
  results.push({ ruleId: rule.id, ruleName: rule.name, triggered: true, reason: `${reason} (non-video deferred)` })
  continue
}

// 1. Parse payload → prompt + params
let payload: { prompt?: string; orientation?: string; resolution?: string; durationSeconds?: number } = {}
if (rule.taskPayloadJson) { try { payload = JSON.parse(rule.taskPayloadJson) } catch {} }
const prompt = (payload.prompt ?? '').trim()
if (!prompt) {
  console.warn(`[media-rules] rule=${rule.id} tidak ada prompt di taskPayloadJson, skip`)
  results.push({ ruleId: rule.id, ruleName: rule.name, triggered: true, reason: `${reason} (no prompt — skipped)` })
  continue
}

// 2. Dedup: jangan generate kalau masih ada GeneratedMedia in-flight untuk rule ini.
//    Pakai clientRef = `media_rule:${rule.id}`.
const inflight = await prisma.generatedMedia.findFirst({
  where: { clientRef: `media_rule:${rule.id}`, status: { in: ['queued', 'processing'] } },
  select: { id: true },
})
if (inflight) {
  results.push({ ruleId: rule.id, ruleName: rule.name, triggered: true, reason: `${reason} (in-flight: ${inflight.id})` })
  continue
}

// 3. Ambil reference photo (scoped ke product/character). Wajib ada minimal 1.
const ref = await prisma.photoReference.findFirst({
  where: {
    status: 'active',
    ...(rule.characterId ? { characterId: rule.characterId } : {}),
    ...(rule.productId ? { productId: rule.productId } : {}),
  },
  orderBy: { createdAt: 'desc' },
  select: { fileUrl: true, storagePath: true },
})
if (!ref) {
  console.warn(`[media-rules] rule=${rule.id} tidak ada reference photo, skip`)
  results.push({ ruleId: rule.id, ruleName: rule.name, triggered: true, reason: `${reason} (no reference photo)` })
  continue
}

// 4. Download image bytes (fileUrl absolute, atau dari storage). Cek helper di src/lib/storage.ts.
//    Kalau fileUrl http(s) → fetch; kalau path lokal → readFile dari storage.
let imageBuffer: Buffer
try {
  if (ref.fileUrl?.startsWith('http')) {
    const resp = await fetch(ref.fileUrl)
    if (!resp.ok) throw new Error(`fetch ref ${resp.status}`)
    imageBuffer = Buffer.from(await resp.arrayBuffer())
  } else {
    const { readFile } = await import('@/lib/storage')
    imageBuffer = await readFile(ref.storagePath ?? '')
  }
} catch (e) {
  console.error(`[media-rules] rule=${rule.id} gagal ambil reference image:`, e)
  results.push({ ruleId: rule.id, ruleName: rule.name, triggered: true, reason: `${reason} (ref image fail)` })
  continue
}

// 5. Hitung credit + cek saldo owner (rule.userId)
const duration = payload.durationSeconds === 6 ? 6 : 10
const resolution = payload.resolution === 'HD' ? 'HD' : 'SD'
const orientation = payload.orientation ?? 'portrait'
const baseCost = duration <= 6 ? 1000 : 1300
const creditsCost = resolution === 'HD' ? baseCost * 2 : baseCost

const owner = await prisma.adminUser.findUnique({ where: { id: rule.userId }, select: { creditBalance: true } })
if (!owner || owner.creditBalance < creditsCost) {
  console.warn(`[media-rules] rule=${rule.id} saldo owner kurang (${owner?.creditBalance ?? 0} < ${creditsCost}), skip`)
  results.push({ ruleId: rule.id, ruleName: rule.name, triggered: true, reason: `${reason} (insufficient credits)` })
  continue
}

// 6. Deduct + create GeneratedMedia + CreditTransaction + txHash (MIRROR gen/video $transaction)
const idempotencyKey = `mediarule_${rule.id}_${now.getTime()}`
const gen = await prisma.$transaction(async (tx) => {
  const updated = await tx.adminUser.update({
    where: { id: rule.userId },
    data: { creditBalance: { decrement: creditsCost } },
    select: { creditBalance: true },
  })
  const gm = await tx.generatedMedia.create({
    data: {
      userId: rule.userId, prompt, status: 'queued', mediaType: 'VIDEO', model: 'geminigen',
      orientation, resolution, durationSeconds: duration, creditsCost,
      clientRef: `media_rule:${rule.id}`,
      productId: rule.productId ?? undefined,   // cek field ada di schema; kalau tidak, drop
      characterId: rule.characterId ?? undefined,
    },
  })
  const txn = await tx.creditTransaction.create({
    data: { userId: rule.userId, amount: -creditsCost, reason: 'media_rule_generation', refId: gm.id, refType: 'generated_media', balanceAfter: updated.creditBalance, idempotencyKey },
  })
  const { generateTxHash } = await import('@/lib/hash-receipt')
  const txHash = generateTxHash({ txId: txn.id, userId: rule.userId, amount: -creditsCost, balanceAfter: updated.creditBalance, idempotencyKey })
  await tx.creditTransaction.update({ where: { id: txn.id }, data: { txHash } })
  return { id: gm.id }
})

// 7. Submit GeminiGen (di luar transaction). Gagal → refund + failed.
try {
  const { submitVideoJob } = await import('@/lib/geminigen')
  const aspectRatio = orientation === 'landscape' ? 'landscape' : orientation === 'square' ? 'square' : 'portrait'
  const externalJobId = await submitVideoJob({ prompt, aspectRatio, durationSeconds: duration, imageBuffer, imageFilename: 'media-rule-ref.jpg' })
  await prisma.generatedMedia.update({ where: { id: gen.id }, data: { externalJobId, status: 'processing' } })
  results.push({ ruleId: rule.id, ruleName: rule.name, triggered: true, reason, taskId: gen.id })
} catch (e) {
  console.error(`[media-rules] rule=${rule.id} GeminiGen submit gagal:`, e)
  await prisma.$transaction([
    prisma.generatedMedia.update({ where: { id: gen.id }, data: { status: 'failed', errorMessage: 'submit failed' } }),
    prisma.adminUser.update({ where: { id: rule.userId }, data: { creditBalance: { increment: creditsCost } } }),
  ])
  results.push({ ruleId: rule.id, ruleName: rule.name, triggered: true, reason: `${reason} (submit failed, refunded)` })
}
```

Lalu tetap update `lastTriggeredAt` + `triggerCount` (sudah ada di bawah). HAPUS blok dedup lama yang pakai `prisma.workerTask.findFirst` (workerTask sudah tidak dipakai di sini — dedup pindah ke GeneratedMedia di step 2).

### Catatan field
- Cek `GeneratedMedia` punya field `productId`/`characterId`? Kalau TIDAK ada di schema, drop dari `create` (jangan tebak). Baca `prisma/schema.prisma` model GeneratedMedia.
- `reason: 'media_rule_generation'` — pastikan kolom `reason` di CreditTransaction free-text (ya, string).

---

## VERIFY
```bash
npx prisma generate
npx tsc --noEmit          # clean selain driver.js
grep -n "workerTask" src/app/api/cron/media-rules/route.ts   # harus 0 (semua referensi worker hilang)
npm run build             # WAJIB sukses
```
Manual (opsional, kalau ada rule ACTIVE + saldo): trigger `POST /api/cron/media-rules` dengan x-cron-secret → cek GeneratedMedia baru dengan clientRef `media_rule:...` muncul status processing.

---

## ATURAN WAJIB
- Baca schema sebelum pakai field. Field gak ada → drop, jangan tebak. Ragu → DEFERRED.
- Owner credit (`rule.userId`) WAJIB dicek — jangan generate kalau saldo kurang (skip + log, jangan crash cron).
- Cron TIDAK boleh throw walau 1 rule gagal — tiap rule di try/skip sendiri (sudah pola loop, jaga itu).
- Photo/IMAGE rule → DEFERRED (submitVideoJob cuma video). Tulis di report.
- tsc + npm run build WAJIB lulus. DILARANG force-push. Commit per logical unit. git pull --rebase kalau ketolak.

## Report: `docs/media-rules-direct-gen-report.md`
- Status rewire, field yang dipakai/di-drop, IMAGE rule deferred?, hasil tsc/build, commit hash.
