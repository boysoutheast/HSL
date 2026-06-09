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

  const post = await prisma.metaPost.findUnique({
    where: { id: params.id },
    include: {
      metaPage: { select: { id: true, pageId: true, pageName: true } },
      schedules: {
        orderBy: { scheduledFor: 'asc' },
      },
      stats: {
        orderBy: { statDate: 'desc' },
        take: 30,
      },
    },
  })

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  return NextResponse.json({ post })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const existing = await prisma.metaPost.findUnique({ where: { id: params.id } })
  if (!existing) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  let body: {
    title?: string
    message?: string
    mediaUrlsJson?: string
    linkUrl?: string
    postType?: string
    status?: string
    metaPageId?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const post = await prisma.metaPost.update({
    where: { id: params.id },
    data: body,
    include: {
      metaPage: { select: { id: true, pageId: true, pageName: true } },
    },
  })

  return NextResponse.json({ post })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const existing = await prisma.metaPost.findUnique({ where: { id: params.id } })
  if (!existing) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  await prisma.metaPost.delete({ where: { id: params.id } })

  return NextResponse.json({ success: true })
}
