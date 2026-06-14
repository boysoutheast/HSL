import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiKey } from '@/lib/api-key-auth'

export const dynamic = 'force-dynamic'

// GET /api/gen/video/[id] — job status
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await requireApiKey(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const job = await prisma.generatedMedia.findFirst({
    where: { id: params.id, userId: user.id },
    select: {
      id: true,
      status: true,
      prompt: true,
      mediaType: true,
      creditsCost: true,
      videoUrl: true,
      thumbnailUrl: true,
      durationSeconds: true,
      orientation: true,
      resolution: true,
      errorMessage: true,
      createdAt: true,
      completedAt: true,
    },
  })

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  return NextResponse.json(job)
}
