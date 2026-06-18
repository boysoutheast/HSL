import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { uploadFile } from '@/lib/storage'
import { requireApiKey } from '@/lib/api-key-auth'
import { requireAuth } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'

async function getUser(req: NextRequest) {
  // Try API key auth first (for Hermes agent / programmatic uploads)
  const apiUser = await requireApiKey(req)
  if (apiUser) return apiUser

  // Fallback: session auth (for web UI uploads)
  const sessionUser = await requireAuth(req)
  if (sessionUser instanceof NextResponse) return null
  return sessionUser
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }

  const label = (formData.get('label') as string) ?? file.name
  const category = (formData.get('category') as string) ?? undefined
  const characterId = (formData.get('characterId') as string) ?? undefined
  const topicId = (formData.get('topicId') as string) ?? undefined
  const productId = (formData.get('productId') as string) ?? undefined
  const instagramAccountId = (formData.get('instagramAccountId') as string) ?? undefined
  const notes = (formData.get('notes') as string) ?? undefined
  const uploadedBy = (formData.get('uploadedBy') as string) ?? undefined

  if (characterId) {
    const owns = await prisma.character.findFirst({
      where: { id: characterId, instagramAccount: { createdByUserId: user.id } },
      select: { id: true },
    })
    if (!owns) return NextResponse.json({ error: 'characterId not owned' }, { status: 403 })
  }

  if (topicId) {
    const owns = await prisma.topic.findFirst({
      where: {
        id: topicId,
        OR: [
          { character: { instagramAccount: { createdByUserId: user.id } } },
          { product: { createdByUserId: user.id } },
        ],
      },
      select: { id: true },
    })
    if (!owns) return NextResponse.json({ error: 'topicId not owned' }, { status: 403 })
  }

  if (productId) {
    const owns = await prisma.product.findFirst({
      where: { id: productId, createdByUserId: user.id },
      select: { id: true },
    })
    if (!owns) return NextResponse.json({ error: 'productId not owned' }, { status: 403 })
  }

  if (instagramAccountId) {
    const owns = await prisma.instagramAccount.findFirst({
      where: { id: instagramAccountId, createdByUserId: user.id },
      select: { id: true },
    })
    if (!owns) return NextResponse.json({ error: 'instagramAccountId not owned' }, { status: 403 })
  }

  // Validate content type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: 'Only JPEG, PNG, WebP, and GIF images are allowed' },
      { status: 400 },
    )
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const key = `photos/${uuidv4()}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const fileUrl = await uploadFile(key, buffer, file.type)

  const photoRef = await prisma.photoReference.create({
    data: {
      uploadedBy,
      fileUrl,
      label,
      category,
      characterId,
      topicId,
      productId,
      instagramAccountId,
      notes,
      status: 'active',
    },
  })

  return NextResponse.json(
    { id: photoRef.id, fileUrl: photoRef.fileUrl, label: photoRef.label },
    { status: 201 },
  )
}
