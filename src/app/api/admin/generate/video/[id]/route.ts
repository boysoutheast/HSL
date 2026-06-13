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

  const item = await prisma.generatedMedia.findFirst({
    where: {
      id: params.id,
      ...(auth.role === 'admin' ? {} : { instagramAccount: { createdByUserId: auth.id } }),
    },
    include: {
      inputs: {
        include: {
          photoReference: {
            select: {
              id: true,
              fileUrl: true,
              thumbnailUrl: true,
              label: true,
              status: true,
            },
          },
        },
        orderBy: { inputOrder: 'asc' },
      },
    },
  })

  if (!item) {
    return NextResponse.json({ error: 'GeneratedMedia not found' }, { status: 404 })
  }

  return NextResponse.json({ item })
}
