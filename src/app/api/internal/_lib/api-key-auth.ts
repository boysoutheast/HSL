import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

/**
 * Validates the x-api-key header against WORKER_API_KEY env var.
 * Returns true if valid, false otherwise.
 */
function validateApiKey(req: NextRequest): boolean {
  const apiKey = req.headers.get('x-api-key')
  return apiKey === process.env.WORKER_API_KEY
}

function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized: invalid or missing x-api-key' }, { status: 401 })
}

export { validateApiKey, unauthorizedResponse }
