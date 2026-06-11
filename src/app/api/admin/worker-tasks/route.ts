import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/admin/worker-tasks?status=pending&capability=content_generation
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const capability = searchParams.get('capability')

  const tasks = await prisma.workerTask.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(capability ? { capability } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      results: {
        select: { id: true, resultType: true, mediaAssetId: true },
      },
    },
  })

  const counts = await prisma.workerTask.groupBy({
    by: ['status'],
    _count: { id: true },
  })

  return NextResponse.json({
    tasks,
    counts: Object.fromEntries(counts.map(c => [c.status, c._count.id])),
  })
}
