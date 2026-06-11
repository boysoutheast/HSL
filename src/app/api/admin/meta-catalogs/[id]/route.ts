import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function findOwned(id: string, auth: { id: string; role: string }) {
  return prisma.metaCatalog.findFirst({
    where: { id, ...(auth.role === 'admin' ? {} : { userId: auth.id }) },
  })
}

// PATCH /api/admin/meta-catalogs/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const catalog = await findOwned(params.id, auth)
  if (!catalog) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const updated = await prisma.metaCatalog.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.metaCatalogId !== undefined ? { metaCatalogId: body.metaCatalogId } : {}),
      ...(body.productCount !== undefined ? { productCount: body.productCount } : {}),
      ...(body.errorMessage !== undefined ? { errorMessage: body.errorMessage } : {}),
      ...(body.status === 'READY' ? { lastSyncedAt: new Date() } : {}),
    },
  })

  return NextResponse.json({ catalog: updated })
}

// DELETE /api/admin/meta-catalogs/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const catalog = await findOwned(params.id, auth)
  if (!catalog) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.metaCatalog.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}

// POST /api/admin/meta-catalogs/[id] — buat product set di catalog ini
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const catalog = await findOwned(params.id, auth)
  if (!catalog) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const productSet = await prisma.metaProductSet.create({
    data: {
      catalogId: params.id,
      name: body.name.trim(),
      filterJson: body.filter ? JSON.stringify(body.filter) : null,
      status: catalog.metaCatalogId ? 'CREATING' : 'DRAFT',
    },
  })

  let taskId: string | null = null
  if (catalog.metaCatalogId) {
    const task = await prisma.workerTask.create({
      data: {
        type: 'create_product_set',
        capability: 'automation_action',
        payloadJson: JSON.stringify({
          productSetId: productSet.id,
          metaCatalogId: catalog.metaCatalogId,
          name: productSet.name,
          filter: body.filter,
          userId: auth.id,
        }),
        priority: 5,
      },
    })
    taskId = task.id
  }

  return NextResponse.json({ productSet, taskId }, { status: 201 })
}
