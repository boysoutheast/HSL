import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateHermesApiKey, extractBearerToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) {
    return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
  }

  const agent = await validateHermesApiKey(token)
  if (!agent) {
    return NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')?.trim() || 'completed'
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 1), 100)

  const assignments = await prisma.assignment.findMany({
    where: {
      hermesAgentId: agent.id,
      assignableType: 'instagram_account',
      status: 'active',
    },
    select: { assignableId: true },
  })

  const instagramAccountIds = assignments.map((a) => a.assignableId)
  if (instagramAccountIds.length === 0) {
    return NextResponse.json({ items: [], total: 0 })
  }

  const where = {
    status,
    instagramAccountId: { in: instagramAccountIds },
  }

  const [total, rows] = await prisma.$transaction([
    prisma.generatedMedia.count({ where }),
    prisma.generatedMedia.findMany({
      where,
      select: {
        id: true,
        status: true,
        videoUrl: true,
        thumbnailUrl: true,
        prompt: true,
        durationSeconds: true,
        instagramAccountId: true,
        completedAt: true,
        inputs: {
          select: {
            photoReferenceId: true,
            inputOrder: true,
            photoReference: {
              select: {
                fileUrl: true,
                label: true,
              },
            },
          },
          orderBy: { inputOrder: 'asc' },
        },
      },
      orderBy: { completedAt: 'desc' },
      take: limit,
    }),
  ])

  const items = rows.map((row) => ({
    id: row.id,
    status: row.status,
    videoUrl: row.videoUrl,
    thumbnailUrl: row.thumbnailUrl,
    prompt: row.prompt,
    durationSeconds: row.durationSeconds,
    instagramAccountId: row.instagramAccountId,
    completedAt: row.completedAt,
    inputs: row.inputs.map((input) => ({
      photoReferenceId: input.photoReferenceId,
      inputOrder: input.inputOrder,
      fileUrl: input.photoReference.fileUrl,
      label: input.photoReference.label,
    })),
  }))

  return NextResponse.json({ items, total })
}
