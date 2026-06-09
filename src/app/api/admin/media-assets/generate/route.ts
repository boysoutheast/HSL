import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: {
    productId?: string
    prompt?: string
    model?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  // Call APIMart /image generation endpoint
  const apiMartUrl = process.env.APIMART_URL ?? 'https://api.apimart.example/v1'
  const apiMartToken = process.env.APIMART_TOKEN ?? ''

  let imageResult: { url?: string; storagePath?: string } = {}
  try {
    const genRes = await fetch(`${apiMartUrl}/image/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiMartToken ? { Authorization: `Bearer ${apiMartToken}` } : {}),
      },
      body: JSON.stringify({
        prompt: body.prompt,
        model: body.model ?? 'dall-e-3',
        product_id: body.productId,
      }),
    })
    if (genRes.ok) {
      imageResult = await genRes.json()
    }
  } catch {
    // APIMart call failed — continue to create asset in PROCESSING state
  }

  const asset = await prisma.mediaAsset.create({
    data: {
      userId: auth.id,
      productId: body.productId ?? null,
      type: 'IMAGE',
      source: 'AI_GENERATED',
      storageProvider: 'apimart',
      storagePath: imageResult.storagePath ?? '',
      publicUrl: imageResult.url ?? null,
      mimeType: 'image/jpeg',
      fileSizeBytes: 0,
      checksum: '',
      status: 'PROCESSING',
      generationPrompt: body.prompt,
      generatedByModel: body.model ?? null,
    },
  })

  return NextResponse.json({ asset }, { status: 201 })
}
