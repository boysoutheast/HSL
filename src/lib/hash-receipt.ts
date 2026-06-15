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
