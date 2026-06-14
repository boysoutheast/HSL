import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateHermesApiKey, extractBearerToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/gen/media/[id]/download — redirect to videoUrl
// Scope: must be owner of the media
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })

  const agent = await validateHermesApiKey(token)
  if (!agent) return NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401 })

  const media = await prisma.generatedMedia.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, status: true, videoUrl: true },
  })

  if (!media || media.userId !== agent.ownerUserId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (media.status !== 'completed' || !media.videoUrl) {
    return NextResponse.json({ error: 'Video not ready', status: media.status }, { status: 409 })
  }

  return NextResponse.redirect(media.videoUrl, 302)
}
