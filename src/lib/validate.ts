/**
 * Input validation helpers for security hardening.
 * Use these instead of raw string assignment from request body.
 */

/**
 * Sanitize a string: trim + cap length.
 * Returns null if value is not a string or is empty after trim.
 */
export function str(val: unknown, max: number): string | null {
  if (typeof val !== 'string') return null
  return val.trim().slice(0, max) || null
}

/**
 * Like str() but returns undefined instead of null.
 * Use when Prisma field is optional (String?).
 */
export function strRequired(val: unknown, max: number): string | undefined {
  const s = str(val, max)
  return s ?? undefined
}
