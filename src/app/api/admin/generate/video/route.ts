import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type CreateBody = {
  prompt?: string
  instagramAccountId?: string
  photoReferenceIds?: string[]
  orientation?: string
  resolution?: string
  durationSeconds?: number
  mediaType?: string
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: CreateBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const prompt = body.prompt?.trim()
  const photoReferenceIds = Array.isArray(body.photoReferenceIds)
    ? body.photoReferenceIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : []
  const instagramAccountId = body.instagramAccountId?.trim() || null
  const orientation = body.orientation?.trim() || 'portrait'
  const resolution = body.resolution === 'HD' ? 'HD' : 'SD'
  const durationSeconds = body.durationSeconds === 6 ? 6 : 10
  const mediaType = body.mediaType?.trim() || 'VIDEO'

  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }
  if (photoReferenceIds.length < 1 || photoReferenceIds.length > 5) {
    return NextResponse.json({ error: 'photoReferenceIds must contain 1 to 5 items' }, { status: 400 })
  }

  const photoReferences = await prisma.photoReference.findMany({
    where: {
      id: { in: photoReferenceIds },
      ...(auth.role === 'admin'
        ? {}
        : {
            OR: [
              { instagramAccount: { createdByUserId: auth.id } },
              { product: { createdByUserId: auth.id } },
            ],
          }),
    },
    select: { id: true },
  })

  if (photoReferences.length !== photoReferenceIds.length) {
    return NextResponse.json({ error: 'One or more photoReferenceIds are invalid or out of scope' }, { status: 403 })
  }

  if (instagramAccountId) {
    const account = await prisma.instagramAccount.findFirst({
      where: {
        id: instagramAccountId,
        ...(auth.role === 'admin' ? {} : { createdByUserId: auth.id }),
      },
      select: { id: true },
    })

    if (!account) {
      return NextResponse.json({ error: 'instagramAccountId is invalid or out of scope' }, { status: 403 })
    }
  }

  const orderedPhotoIds = photoReferenceIds.map((id) => id.trim())

  const result = await prisma.$transaction(async (tx) => {
    const generatedMedia = await tx.generatedMedia.create({
      data: {
        prompt,
        instagramAccountId,
        status: 'queued',
        orientation,
        resolution,
        durationSeconds,
        mediaType,
      },
    })

    await tx.generatedMediaInput.createMany({
      data: orderedPhotoIds.map((photoReferenceId, index) => ({
        generatedMediaId: generatedMedia.id,
        photoReferenceId,
        inputOrder: index,
      })),
    })

    const workerTask = await tx.workerTask.create({
      data: {
        type: 'GENERATE_VIDEO',
        payloadJson: JSON.stringify({
          generatedMediaId: generatedMedia.id,
          prompt,
          instagramAccountId,
          photoReferenceIds: orderedPhotoIds,
          orientation,
          resolution,
          durationSeconds,
        }),
        scope: 'internal',
        status: 'pending',
        priority: 2,
      },
    })

    const updated = await tx.generatedMedia.update({
      where: { id: generatedMedia.id },
      data: { workerTaskId: workerTask.id },
      select: { id: true, status: true, workerTaskId: true },
    })

    return updated
  })

  return NextResponse.json(result, { status: 201 })
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')?.trim() || undefined
  const instagramAccountId = searchParams.get('instagramAccountId')?.trim() || undefined
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 1), 100)
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0)

  const where = {
    ...(status ? { status } : {}),
    ...(instagramAccountId ? { instagramAccountId } : {}),
    ...(auth.role === 'admin' ? {} : { instagramAccount: { createdByUserId: auth.id } }),
  }

  const [total, items] = await prisma.$transaction([
    prisma.generatedMedia.count({ where }),
    prisma.generatedMedia.findMany({
      where,
      include: {
        inputs: {
          include: {
            photoReference: {
              select: {
                id: true,
                fileUrl: true,
                label: true,
              },
            },
          },
          orderBy: { inputOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
  ])

  return NextResponse.json({ items, pagination: { total, limit, offset } })
}
