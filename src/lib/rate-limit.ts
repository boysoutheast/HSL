const BASE_LOCKOUT_MS = 120_000 // 2 menit pertama

type Bucket = {
  failCount: number
  lockoutUntil: number   // epoch ms; 0 = tidak terkunci
  lockoutCount: number   // sudah berapa kali di-lockout (untuk multiplier)
}

const globalForRateLimit = globalThis as unknown as {
  rateLimitBuckets: Map<string, Bucket> | undefined
}

const buckets =
  globalForRateLimit.rateLimitBuckets ?? new Map<string, Bucket>()

globalForRateLimit.rateLimitBuckets = buckets

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; resetAt: number; waitSeconds: number }

function getBucket(key: string): Bucket {
  let b = buckets.get(key)
  if (!b) {
    b = { failCount: 0, lockoutUntil: 0, lockoutCount: 0 }
    buckets.set(key, b)
  }
  return b
}

/** Cek apakah key sedang terkunci. Tidak mutate state. */
export function isLocked(key: string): RateLimitResult {
  const b = getBucket(key)
  const now = Date.now()
  if (b.lockoutUntil > now) {
    return {
      allowed: false,
      resetAt: b.lockoutUntil,
      waitSeconds: Math.ceil((b.lockoutUntil - now) / 1000),
    }
  }
  return { allowed: true }
}

/** Rekam satu login GAGAL. Return apakah sekarang terkunci setelah ini. */
export function recordFailure(key: string, maxFails = 5): RateLimitResult {
  const b = getBucket(key)
  const now = Date.now()

  // Kalau lockout sudah habis, reset fail count tapi pertahankan lockoutCount
  if (b.lockoutUntil > 0 && b.lockoutUntil <= now) {
    b.failCount = 0
    b.lockoutUntil = 0
    // lockoutCount TIDAK direset → multiplier terus naik
  }

  b.failCount += 1

  if (b.failCount >= maxFails) {
    const duration = BASE_LOCKOUT_MS * Math.pow(2, b.lockoutCount) // 120s, 240s, 480s…
    b.lockoutUntil = now + duration
    b.lockoutCount += 1
    b.failCount = 0
    return {
      allowed: false,
      resetAt: b.lockoutUntil,
      waitSeconds: Math.ceil(duration / 1000),
    }
  }

  return { allowed: true }
}

/** Reset setelah login SUKSES. */
export function recordSuccess(key: string) {
  const b = getBucket(key)
  b.failCount = 0
  b.lockoutUntil = 0
  // lockoutCount dikurangi 1 kalau mau "ampuni" setelah berhasil masuk
  if (b.lockoutCount > 0) b.lockoutCount -= 1
}

// ── Generic rate limiter (masih dipakai di CAPI dll) ──────────────────────────

export type GenericRLResult = {
  allowed: boolean
  remaining: number
  resetAt: number
}

type GenericBucket = { count: number; resetAt: number }

const globalForGeneric = globalThis as unknown as {
  genericRLBuckets: Map<string, GenericBucket> | undefined
}
const genericBuckets =
  globalForGeneric.genericRLBuckets ?? new Map<string, GenericBucket>()
globalForGeneric.genericRLBuckets = genericBuckets

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): GenericRLResult {
  const now = Date.now()
  const existing = genericBuckets.get(key)

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs
    genericBuckets.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: Math.max(0, limit - 1), resetAt }
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt }
  }

  existing.count += 1
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  }
}

export function getRateLimitKey(req: Request, scope: string): string {
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = req.headers.get('x-real-ip')?.trim()
  const ip = forwardedFor || realIp || 'unknown'
  return `${scope}:${ip}`
}
