import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashApiKey } from '@/lib/auth'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export type ApiKeyUser = {
  id: string
  email: string
  name: string | null
  role: string
  creditBalance: number
}

/** Authenticate via x-api-key header. Returns user or null. */
export async function requireApiKey(req: NextRequest): Promise<ApiKeyUser | null> {
  // Support both x-api-key header and Authorization: Bearer <key>
  let key = req.headers.get('x-api-key')
  if (!key) {
    const auth = req.headers.get('authorization')
    if (auth?.startsWith('Bearer ')) {
      key = auth.slice(7).trim()
    }
  }
  if (!key || key.length < 20) return null

  const hash = hashApiKey(key)
  const apiKey = await prisma.userApiKey.findFirst({
    where: { keyHash: hash, status: 'active' },
    include: { user: { select: { id: true, email: true, name: true, role: true, creditBalance: true } } },
  })
  if (!apiKey) {
    // Debug: log key prefix so we can identify which key is being used
    console.warn('[requireApiKey] auth failed — key prefix:', key.slice(0, 12))
    return null
  }

  // Update last_used_at asynchronously
  prisma.userApiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {})

  return apiKey.user
}

/** Generate a user API key with hsk_ prefix. Returns the raw key once. */
export function generateApiKey(): { raw: string; prefix: string } {
  const rawBytes = crypto.randomBytes(24)
  const raw = 'hsk_' + rawBytes.toString('base64url')
  const prefix = raw.slice(0, 12) // hsk_XXXXXXXX
  return { raw, prefix }
}
