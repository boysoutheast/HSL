import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateHermesApiKey, extractBearerToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/gen/media — list generated media (videos)
export async function GET(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })

  const agent = await validateHermesApiKey(token)
  if (!agent) return NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')?.trim() || 'completed'
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 1), 100)

  const where = { status, userId: agent.ownerUserId }

  const [total, rows] = await prisma.$transaction([
    prisma.generatedMedia.count({ where }),
    prisma.generatedMedia.findMany({
      where,
      select: { id: true, status: true, videoUrl: true, thumbnailUrl: true, prompt: true, durationSeconds: true, instagramAccountId: true, completedAt: true },
      orderBy: { completedAt: 'desc' },
      take: limit,
    }),
  ])

  return NextResponse.json({ items: rows, total })
}
