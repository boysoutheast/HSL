import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateApiKey, unauthorizedResponse } from '../../_lib/api-key-auth'

export const runtime = 'nodejs'

/**
 * POST /api/internal/photo-references/batch
 * Resolve photo reference IDs to their file URLs.
 * Input: { ids: string[] }
 * Returns: { items: [{ id, fileUrl }] }
 */
export async function POST(req: NextRequest) {
  if (!validateApiKey(req)) {
    return unauthorizedResponse()
  }

  let body: { ids?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const ids = body.ids
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 })
  }

  if (ids.length > 50) {
    return NextResponse.json({ error: 'ids array limited to 50 items' }, { status: 400 })
  }

  const refs = await prisma.photoReference.findMany({
    where: {
      id: { in: ids },
      status: 'active',
    },
    select: {
      id: true,
      fileUrl: true,
    },
  })

  return NextResponse.json({
    items: refs,
    requested: ids.length,
    found: refs.length,
  })
}
