type Bucket = {
  count: number
  resetAt: number
}

const globalForRateLimit = globalThis as unknown as {
  rateLimitBuckets: Map<string, Bucket> | undefined
}

const buckets = globalForRateLimit.rateLimitBuckets ?? new Map<string, Bucket>()

if (process.env.NODE_ENV !== 'production') {
  globalForRateLimit.rateLimitBuckets = buckets
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs
    buckets.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: Math.max(0, limit - 1), resetAt }
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt }
  }

  existing.count += 1
  return { allowed: true, remaining: Math.max(0, limit - existing.count), resetAt: existing.resetAt }
}

export function getRateLimitKey(req: Request, scope: string): string {
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = req.headers.get('x-real-ip')?.trim()
  const ip = forwardedFor || realIp || 'unknown'
  return `${scope}:${ip}`
}
