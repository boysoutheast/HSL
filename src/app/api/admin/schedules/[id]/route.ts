import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const schedule = await prisma.metaSchedule.findUnique({
    where: { id: params.id },
    include: {
      metaPage: { select: { id: true, pageId: true, pageName: true } },
      metaPost: { select: { id: true, title: true, message: true, status: true } },
    },
  })

  if (!schedule) {
    return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
  }

  return NextResponse.json({ schedule })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const existing = await prisma.metaSchedule.findUnique({ where: { id: params.id } })
  if (!existing) {
    return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
  }

  let body: {
    metaPageId?: string
    metaPostId?: string
    title?: string
    postType?: string
    payloadJson?: string
    scheduledFor?: string
    status?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {}
  if (body.metaPageId !== undefined) updateData.metaPageId = body.metaPageId
  if (body.metaPostId !== undefined) updateData.metaPostId = body.metaPostId
  if (body.title !== undefined) updateData.title = body.title
  if (body.postType !== undefined) updateData.postType = body.postType
  if (body.payloadJson !== undefined) updateData.payloadJson = body.payloadJson
  if (body.status !== undefined) updateData.status = body.status
  if (body.scheduledFor !== undefined) updateData.scheduledFor = new Date(body.scheduledFor)

  const schedule = await prisma.metaSchedule.update({
    where: { id: params.id },
    data: updateData,
    include: {
      metaPage: { select: { id: true, pageId: true, pageName: true } },
      metaPost: { select: { id: true, title: true, message: true, status: true } },
    },
  })

  return NextResponse.json({ schedule })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const existing = await prisma.metaSchedule.findUnique({ where: { id: params.id } })
  if (!existing) {
    return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
  }

  await prisma.metaSchedule.delete({ where: { id: params.id } })

  return NextResponse.json({ success: true })
}
