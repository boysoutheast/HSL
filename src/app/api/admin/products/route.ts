import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, ownerFilter } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const products = await prisma.product.findMany({
    where: {
      ...ownerFilter(auth),
      ...(status ? { status } : {}),
    },
    include: {
      _count: { select: { topics: true, ceps: true, photoReferences: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ products })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    name: string
    description?: string
    mainBenefit?: string
    productUrl?: string
    ingredients?: string
    usageInstruction?: string
    price?: number
    shopeeUrl?: string
    notes?: string
    status?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const product = await prisma.product.create({
    data: {
      name: body.name,
      description: body.description,
      mainBenefit: body.mainBenefit,
      productUrl: body.productUrl,
      ingredients: body.ingredients,
      usageInstruction: body.usageInstruction,
      price: body.price,
      shopeeUrl: body.shopeeUrl,
      notes: body.notes,
      status: body.status ?? 'active',
      createdByUserId: auth.id,
    },
  })

  return NextResponse.json({ product }, { status: 201 })
}
