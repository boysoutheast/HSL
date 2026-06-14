import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { uploadFile } from '@/lib/storage'
import { requireApiKey } from '@/lib/api-key-auth'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const user = await requireApiKey(req)
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
