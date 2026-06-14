import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, ownerFilter } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('productId')
  const type = searchParams.get('type')
  const status = searchParams.get('status')
  const source = searchParams.get('source')
  const search = searchParams.get('search')

  const where: Record<string, unknown> = {
    ...ownerFilter(auth),
    ...(productId ? { productId } : {}),
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(source ? { source } : {}),
    ...(search
      ? {
          OR: [
            { publicUrl: { contains: search, mode: 'insensitive' as const } },
            { storagePath: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const assets = await prisma.mediaAsset.findMany({
    where,
    include: {
      product: { select: { id: true, name: true } },
      _count: { select: { creativeVariants: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ assets })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    productId?: string
    type?: string
    source?: string
    storageProvider?: string
    storagePath?: string
    publicUrl?: string
    mimeType?: string
    fileSizeBytes?: number
    width?: number
    height?: number
    checksum?: string
    status?: string
    generationPrompt?: string
    generatedByModel?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const asset = await prisma.mediaAsset.create({
    data: {
      userId: auth.id,
      productId: body.productId ?? null,
      type: body.type ?? 'IMAGE',
      source: body.source ?? 'USER_UPLOAD',
      storageProvider: body.storageProvider ?? 'local',
      storagePath: body.storagePath ?? '',
      publicUrl: body.publicUrl ?? null,
      mimeType: body.mimeType ?? 'image/jpeg',
      fileSizeBytes: body.fileSizeBytes ?? 0,
      width: body.width ?? null,
      height: body.height ?? null,
      checksum: body.checksum ?? '',
      status: body.status ?? 'PROCESSING',
      generationPrompt: body.generationPrompt ?? null,
      generatedByModel: body.generatedByModel ?? null,
    },
  })

  return NextResponse.json({ asset }, { status: 201 })
}
