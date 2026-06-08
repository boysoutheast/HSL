import { promises as fs } from 'fs'
import path from 'path'

const STORAGE_ROOT = process.env.STORAGE_ROOT ?? '/data/photos'
const PUBLIC_BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL ?? '').replace(/\/$/, '')

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

function publicUrlFor(key: string): string {
  // key is e.g. "photos/uuid.jpg" — serve via API route
  const cleanKey = key.replace(/^\/+/, '')
  return `${PUBLIC_BASE_URL}/api/photos/serve/${cleanKey}`
}

export async function uploadFile(
  key: string,
  body: Buffer,
  _contentType: string,
): Promise<string> {
  const cleanKey = key.replace(/^\/+/, '')
  const absPath = path.join(STORAGE_ROOT, cleanKey)
  await ensureDir(path.dirname(absPath))
  await fs.writeFile(absPath, body)
  return publicUrlFor(cleanKey)
}

export async function readFile(key: string): Promise<Buffer> {
  const cleanKey = key.replace(/^\/+/, '')
  const absPath = path.join(STORAGE_ROOT, cleanKey)
  // Guard against path traversal
  const resolvedRoot = path.resolve(STORAGE_ROOT)
  const resolvedFile = path.resolve(absPath)
  if (!resolvedFile.startsWith(resolvedRoot + path.sep) && resolvedFile !== resolvedRoot) {
    throw new Error('Invalid path')
  }
  return fs.readFile(resolvedFile)
}

export async function fileExists(key: string): Promise<boolean> {
  try {
    const cleanKey = key.replace(/^\/+/, '')
    await fs.access(path.join(STORAGE_ROOT, cleanKey))
    return true
  } catch {
    return false
  }
}

// Backwards-compatible API kept for any future caller — returns the public URL directly
export async function getSignedUploadUrl(_key: string, _contentType: string): Promise<string> {
  throw new Error('getSignedUploadUrl is not supported on filesystem storage; use POST /api/photos upload instead')
}

export async function getSignedDownloadUrl(key: string): Promise<string> {
  return publicUrlFor(key)
}
