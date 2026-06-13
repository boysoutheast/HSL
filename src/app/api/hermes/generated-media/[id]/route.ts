import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateHermesApiKey, extractBearerToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/hermes/generated-media/[id] — get status + result of a generation job
// Scope: agent.ownerUserId must match the media's userId
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) {
    return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
  }

  const agent = await validateHermesApiKey(token)
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401 })
  }

  const media = await prisma.generatedMedia.findUnique({
    where: { id: params.id },
    include: {
      inputs: {
        include: {
          photoReference: { select: { id: true, fileUrl: true, label: true } },
        },
      },
    },
  })

  if (!media) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Scope: only the billing owner or the creating agent can view
  if (media.userId !== agent.ownerUserId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: media.id,
    status: media.status,
    prompt: media.prompt,
    mediaType: media.mediaType,
    creditsCost: media.creditsCost,
    videoUrl: media.videoUrl,
    thumbnailUrl: media.thumbnailUrl,
    durationSeconds: media.durationSeconds,
    errorMessage: media.errorMessage,
    refundedAt: media.refundedAt,
    createdAt: media.createdAt,
    completedAt: media.completedAt,
    inputs: media.inputs.map(inp => ({
      photoReferenceId: inp.photoReferenceId,
      fileUrl: inp.photoReference.fileUrl,
      label: inp.photoReference.label,
      order: inp.inputOrder,
    })),
  })
}
