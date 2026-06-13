import crypto from 'crypto'

const ALGO = 'aes-256-gcm'
const DEV_FALLBACK_KEY = 'hsl-dev-key-not-for-production-change-me'
const RAW_KEY = process.env.ENCRYPTION_KEY ?? DEV_FALLBACK_KEY

if (process.env.NODE_ENV === 'production' && RAW_KEY === DEV_FALLBACK_KEY) {
  throw new Error('ENCRYPTION_KEY wajib diset di production. Refusing to use insecure dev fallback key.')
}

const KEY = crypto.createHash('sha256').update(RAW_KEY).digest()

export function encode(plaintext: string): string {
  if (!plaintext) return ''
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decode(encoded: string): string {
  if (!encoded) return ''
  const raw = Buffer.from(encoded, 'base64')
  const iv = raw.subarray(0, 12)
  const tag = raw.subarray(12, 28)
  const encrypted = raw.subarray(28)
  const decipher = crypto.createDecipheriv(ALGO, KEY, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

export function redact(value?: string | null): string | null {
  if (!value) return null
  if (value.length <= 8) return '***'
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

export function safeMetaError(data: unknown): string {
  const message = typeof data === 'object' && data && 'error' in data
    ? (data as { error?: { message?: string } }).error?.message
    : null
  return message ?? 'Meta API request failed'
}