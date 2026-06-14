import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateHermesApiKey, extractBearerToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/gen/media/[id] — get status + result of a generation job
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })

  const agent = await validateHermesApiKey(token)
  if (!agent) return NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401 })

  const media = await prisma.generatedMedia.findUnique({
    where: { id: params.id },
    include: { inputs: { include: { photoReference: { select: { id: true, fileUrl: true, label: true } } } } },
  })

  if (!media || media.userId !== agent.ownerUserId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: media.id, status: media.status, prompt: media.prompt, mediaType: media.mediaType,
    creditsCost: media.creditsCost, videoUrl: media.videoUrl, thumbnailUrl: media.thumbnailUrl,
    durationSeconds: media.durationSeconds, errorMessage: media.errorMessage,
    refundedAt: media.refundedAt, createdAt: media.createdAt, completedAt: media.completedAt,
    resolution: media.resolution, orientation: media.orientation,
    inputs: media.inputs.map(inp => ({ photoReferenceId: inp.photoReferenceId, fileUrl: inp.photoReference.fileUrl, label: inp.photoReference.label, order: inp.inputOrder })),
  })
}
