import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateApiKey, unauthorizedResponse } from '../../../_lib/api-key-auth'

export const runtime = 'nodejs'

/**
 * PATCH /api/internal/generated-media/[id]
 * Update generated_media record — used by Hermes worker.
 *
 * Allowed fields:
 *   externalJobId  — set when video gen submission succeeds (GENERATE_VIDEO)
 *   status         — processing | completed | failed
 *   videoUrl       — set when video uploaded (REHOST_VIDEO)
 *   thumbnailUrl   — set when video uploaded (REHOST_VIDEO)
 *   errorMessage   — set on failure
 *   completedAt    — set on completion
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!validateApiKey(req)) {
    return unauthorizedResponse()
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const allowedFields = new Set([
    'externalJobId',
    'status',
    'videoUrl',
    'thumbnailUrl',
    'errorMessage',
    'completedAt',
  ])

  const data: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    if (!allowedFields.has(key)) {
      continue
    }
    // completedAt must be ISO string
    if (key === 'completedAt' && typeof value !== 'string') {
      continue
    }
    data[key] = value
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No allowed fields provided' }, { status: 400 })
  }

  try {
    const before = await prisma.generatedMedia.findUnique({
      where: { id: params.id },
      select: { id: true },
    })

    if (!before) {
      return NextResponse.json({ error: 'GeneratedMedia not found' }, { status: 404 })
    }

    const updated = await prisma.generatedMedia.update({
      where: { id: params.id },
      data,
    })

    return NextResponse.json({ ok: true, id: updated.id, status: updated.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Failed to update GeneratedMedia', message }, { status: 500 })
  }
}
