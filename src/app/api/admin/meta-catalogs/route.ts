import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/admin/meta-catalogs
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const catalogs = await prisma.metaCatalog.findMany({
    where: auth.role === 'admin' ? {} : { userId: auth.id },
    include: { productSets: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ catalogs })
}

// POST /api/admin/meta-catalogs — draft catalog + task untuk buat di Meta
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => null)
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const catalog = await prisma.metaCatalog.create({
    data: {
      userId: auth.id,
      metaBusinessId: body.metaBusinessId ?? null,
      name: body.name.trim(),
      vertical: body.vertical ?? 'commerce',
      isCpas: body.isCpas ?? false,
      partnerName: body.partnerName?.trim() || null,
      status: body.metaBusinessId ? 'CREATING' : 'DRAFT',
    },
  })

  let taskId: string | null = null
  if (body.metaBusinessId) {
    const task = await prisma.workerTask.create({
      data: {
        type: 'create_catalog',
        capability: 'automation_action',
        payloadJson: JSON.stringify({
          catalogId: catalog.id,
          metaBusinessId: body.metaBusinessId,
          name: catalog.name,
          vertical: catalog.vertical,
          isCpas: catalog.isCpas,
          userId: auth.id,
        }),
        priority: 5,
        scope: 'internal',
      },
    })
    taskId = task.id
  }

  return NextResponse.json({ catalog, taskId }, { status: 201 })
}
