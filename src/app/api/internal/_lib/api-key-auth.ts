import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { timingSafeEqual } from 'crypto'

export const runtime = 'nodejs'

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/**
 * Validates the x-api-key header against WORKER_API_KEY env var.
 * Returns true if valid, false otherwise.
 */
function validateApiKey(req: NextRequest): boolean {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) return false
  const expected = process.env.WORKER_API_KEY
  if (!expected) return false
  return safeEqual(apiKey, expected)
}

function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized: invalid or missing x-api-key' }, { status: 401 })
}

export { validateApiKey, unauthorizedResponse }
