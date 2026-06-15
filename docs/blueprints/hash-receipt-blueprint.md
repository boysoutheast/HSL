# Blueprint: Hash Receipt System — Credits + Generated Media

**Owner:** Boy Tenggara · Status: APPROVED FOR EXECUTION
**Auditor:** Fable 5 (2026-06-15)
**Executor:** Sonnet
**Estimasi:** 20–25 menit

---

## Scope

**DALAM scope (hash):**
- `CreditTransaction` — tiap transaksi (debit/grant/refund) dapat receipt hash
- `GeneratedMedia` — video completed dapat delivery hash, revoked saat refund

**LUAR scope (jangan disentuh fungsi, cukup cleanup):**
- Campaign table dan semua campaign-related — hanya rapiin log yang verbose
- Jangan tambah hash ke campaign, worker_tasks, sessions, dll

---

## Desain Hash

### Hash function (src/lib/hash-receipt.ts — file baru)

```ts
import { createHmac } from 'crypto'

function secret(): string {
  const s = process.env.HASH_SECRET
  if (!s || s.length < 32) throw new Error('HASH_SECRET wajib diset (min 32 chars)')
  return s
}

// Receipt hash untuk CreditTransaction
// Input: immutable fields — tidak bisa diforge tanpa server secret
export function generateTxHash(params: {
  txId: string
  userId: string
  amount: number
  balanceAfter: number
  idempotencyKey: string
}): string {
  const payload = `tx:${params.txId}:${params.userId}:${params.amount}:${params.balanceAfter}:${params.idempotencyKey}`
  return createHmac('sha256', secret()).update(payload).digest('hex')
}

// Delivery hash untuk GeneratedMedia — hanya saat completed
export function generateMediaHash(params: {
  mediaId: string
  userId: string
  videoUrl: string
  completedAt: string   // ISO string
  creditsCost: number
}): string {
  const payload = `media:${params.mediaId}:${params.userId}:${params.videoUrl}:${params.completedAt}:${params.creditsCost}`
  return createHmac('sha256', secret()).update(payload).digest('hex')
}

// Verify hash tanpa expose secret ke caller
export function verifyTxHash(hash: string, params: Parameters<typeof generateTxHash>[0]): boolean {
  return generateTxHash(params) === hash
}
export function verifyMediaHash(hash: string, params: Parameters<typeof generateMediaHash>[0]): boolean {
  return generateMediaHash(params) === hash
}
```

---

## PHASE 1 — Migration

File: `prisma/migrations/20260615100000_hash_receipts/migration.sql`

```sql
-- CreditTransaction: tambah receipt hash
ALTER TABLE credit_transactions
  ADD COLUMN IF NOT EXISTS tx_hash TEXT UNIQUE;

-- GeneratedMedia: tambah delivery hash + revoke tracking
ALTER TABLE generated_media
  ADD COLUMN IF NOT EXISTS media_hash      TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS media_hash_revoked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_credit_transactions_tx_hash ON credit_transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_generated_media_media_hash  ON generated_media(media_hash);
```

Prisma schema — tambah ke model:

```prisma
// CreditTransaction
txHash   String?  @unique @map("tx_hash")

// GeneratedMedia
mediaHash            String?   @unique @map("media_hash")
mediaHashRevokedAt   DateTime? @map("media_hash_revoked_at")
```

---

## PHASE 2 — Credits lib (src/lib/credits.ts)

Import `generateTxHash` dari hash-receipt.ts.

Tambah `txHash` ke setiap transaction create:

**debitCredits:**
```ts
// Di dalam $transaction, setelah hitung balanceAfter:
const txId = crypto.randomUUID() // generate dulu sebelum insert
const txHash = generateTxHash({ txId, userId, amount: -amount, balanceAfter, idempotencyKey: key })

await tx.creditTransaction.create({
  data: {
    id: txId,
    userId,
    amount: -amount,
    reason,
    refId,
    refType: refId ? 'generated_media' : undefined,
    balanceAfter,
    idempotencyKey: key,
    txHash,   // ← tambah ini
  },
})
```

Pola sama untuk **grantCredits** dan **refundCredits** (refund = positive amount).

Catatan: CreditTransaction.id default `@default(cuid())` — untuk generate hash sebelum insert, generate id manual dulu dengan `cuid()` dari `@paralleldrive/cuid2` atau pakai `crypto.randomUUID()` kemudian update schema `@default(dbgenerated("gen_random_uuid()"))` — ATAU generate hash setelah create dan langsung update. Cara termudah:

```ts
const txn = await tx.creditTransaction.create({ data: { ... tanpa txHash } })
const txHash = generateTxHash({ txId: txn.id, userId, amount: txn.amount, balanceAfter, idempotencyKey: key })
await tx.creditTransaction.update({ where: { id: txn.id }, data: { txHash } })
return { balanceAfter, transactionId: txn.id, txHash }
```

Ini dalam satu $transaction jadi atomic.

---

## PHASE 3 — Generated Media hash (saat completed)

Cari tempat worker update GeneratedMedia status → completed. Kemungkinan:
- `src/app/api/internal/generated-media/[id]/route.ts` (PATCH)
- `src/app/api/webhooks/geminigen/route.ts`

Di KEDUA tempat, saat status menjadi `completed` DAN `videoUrl` tidak null:

```ts
import { generateMediaHash } from '@/lib/hash-receipt'

// Setelah update status=completed + videoUrl:
if (newStatus === 'completed' && videoUrl) {
  const completedAt = new Date().toISOString()
  const mediaHash = generateMediaHash({
    mediaId: media.id,
    userId: media.userId ?? '',
    videoUrl,
    completedAt,
    creditsCost: media.creditsCost ?? 0,
  })
  await prisma.generatedMedia.update({
    where: { id: media.id },
    data: { mediaHash, completedAt: new Date(completedAt) },
  })
}
```

**Saat refund** (`src/lib/credits.ts` → `refundCredits`):
```ts
// Setelah refund berhasil, revoke media hash
await prisma.generatedMedia.update({
  where: { id: generatedMediaId },
  data: { mediaHashRevokedAt: new Date() },
})
```

---

## PHASE 4 — API endpoints (expose hash ke user)

### GET /api/gen/video/[id]
Tambah `mediaHash` + `mediaHashRevokedAt` ke select dan response.

### GET /api/gen/credits (atau connections/credits)
Tambah `txHash` ke recentTransactions select.

### GET /api/gen/video (list)
Tambah `mediaHash` ke select fields.

---

## PHASE 5 — Admin Hash Checker

**Endpoint:** `POST /api/admin/hash-check`
Auth: requireAdmin

```ts
// Body: { hash: string }
// Lookup di CreditTransaction dan GeneratedMedia
// Return: { found: true, type: 'tx' | 'media', record: {...}, valid: boolean, revoked: boolean }
```

```ts
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (admin instanceof NextResponse) return admin

  const { hash } = await req.json()
  if (!hash || typeof hash !== 'string' || hash.length !== 64) {
    return NextResponse.json({ error: 'Invalid hash' }, { status: 400 })
  }

  // Cari di CreditTransaction
  const tx = await prisma.creditTransaction.findUnique({
    where: { txHash: hash },
    select: {
      id: true, userId: true, amount: true, reason: true,
      balanceAfter: true, createdAt: true, refId: true,
      user: { select: { email: true, name: true } },
    },
  })
  if (tx) {
    return NextResponse.json({ found: true, type: 'tx', record: tx, revoked: false })
  }

  // Cari di GeneratedMedia
  const media = await prisma.generatedMedia.findUnique({
    where: { mediaHash: hash },
    select: {
      id: true, userId: true, status: true, prompt: true,
      creditsCost: true, videoUrl: true, completedAt: true,
      mediaHashRevokedAt: true,
      user: { select: { email: true, name: true } },
    },
  })
  if (media) {
    return NextResponse.json({
      found: true,
      type: 'media',
      record: media,
      revoked: !!media.mediaHashRevokedAt,
    })
  }

  return NextResponse.json({ found: false })
}
```

**UI: System → tab baru "Hash Checker"** (compact tab, hanya untuk admin)

```tsx
// Tambah ke adminTabs di src/app/system/page.tsx:
{ id: 'hash-checker', label: 'Hash Checker' }

// Panel: input box + fetch ke /api/admin/hash-check + display result
// Result: hijau jika valid, merah jika revoked, abu jika not found
```

---

## PHASE 6 — Credit Balance Detail (UI)

**Lokasi:** `src/app/system/ConnectionsTab.tsx`

Saldo sekarang ditampilkan sebagai angka statis. Ubah jadi clickable → buka modal/drawer dengan:
- List `CreditTransaction` terbaru (dari `/api/admin/connections/credits`)
- Per baris: tanggal, reason, amount (merah=debit, hijau=grant), balanceAfter, txHash (monospace, truncated ke 12 char + "..." + copy button)
- Link ke Hash Checker bila klik hash

---

## PHASE 7 — Campaign Log Cleanup (NO hash, hanya cleanup)

Cari dan hapus/minimize console.log yang verbose di campaign routes:
```bash
grep -rn "console\.log" src/app/api/admin/campaign-sessions/ src/app/api/admin/test-launches/ src/app/api/cron/ --include="*.ts"
```

- Hapus debug log yang berisi payload JSON besar
- Keep: `console.error` untuk error handling
- Keep: meaningful info log (e.g., "[cron] processed N campaigns")
- Jangan ubah logic, jangan tambah field, jangan ubah schema campaign

---

## PHASE 8 — Env + Self-Refinement

**Env baru yang dibutuhkan:**
```
HASH_SECRET=<random 32+ chars, generate via: openssl rand -hex 32>
```
Tambah ke `.env.example` dengan placeholder, jangan nilai asli.

**Self-refinement grep:**
```bash
# Pastikan tidak ada tempat lain yang update status=completed tanpa generate hash
grep -rn "status.*completed\|completed.*status" src/app/api/ --include="*.ts" | grep -i "generatedmedia\|generated_media"

# Pastikan txHash di-generate di semua 3 fungsi credits
grep -rn "creditTransaction.create\|credit_transaction.*insert" src/ --include="*.ts"

# Pastikan HASH_SECRET tidak di-hardcode
grep -rn "HASH_SECRET" src/ --include="*.ts" | grep -v "process\.env"
```

---

## PHASE 9 — Final Report

Buat `docs/hash-receipt-report.md`:
- Semua phase: DONE / DEFERRED
- Kolom baru yang ditambah
- Endpoint baru
- Cara verify hash (manual steps)
- Residual risk

---

## Execution Order

```
1. Buat src/lib/hash-receipt.ts
2. Migration SQL + prisma generate
3. Update src/lib/credits.ts (debit + grant + refund → txHash)
4. Update generated-media update handler + webhook (mediaHash saat completed)
5. Update refundCredits → set mediaHashRevokedAt
6. Update GET /api/gen/video/[id] + /api/gen/credits expose hash fields
7. Buat POST /api/admin/hash-check
8. Tambah Hash Checker tab + UI di System page
9. Update ConnectionsTab credit detail (clickable balance + txHash per row)
10. Campaign log cleanup
11. Tambah HASH_SECRET ke .env.example
12. Self-refinement grep (Phase 8)
13. tsc --noEmit → fix
14. Commit per phase → push
15. Buat docs/hash-receipt-report.md
```

---

## Aturan Wajib

- `HASH_SECRET` JANGAN di-hardcode, JANGAN ke log, JANGAN ke response
- Hash hanya expose ke pemilik resource atau admin — jangan bocor ke user lain
- `mediaHash` hanya digenerate saat `status=completed` DAN `videoUrl` tidak null
- `txHash` digenerate dalam $transaction yang sama dengan insert CreditTransaction
- Jangan ubah schema campaign, worker_tasks, sessions
- Migration: IF NOT EXISTS semua, no DEFAULT cuid()
- tsc --noEmit sebelum tiap commit
- Commit per phase, no force-push
- Kalau ambigu → DEFERRED di report, lanjut
```
