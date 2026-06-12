import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, ownerFilter } from '@/lib/auth'
import { llmConfigured, llmJson, LlmError } from '@/lib/llm'

export const dynamic = 'force-dynamic'

type Tone = 'soft_selling' | 'hard_selling' | 'edukasi'

function truncateAtWord(text: string, max: number): { text: string; truncated: boolean } {
  const clean = (text || '').trim().replace(/\s+/g, ' ')
  if (clean.length <= max) return { text: clean, truncated: false }
  const sliced = clean.slice(0, max + 1)
  const lastSpace = sliced.lastIndexOf(' ')
  const finalText = (lastSpace > Math.floor(max * 0.6) ? sliced.slice(0, lastSpace) : clean.slice(0, max)).trim()
  return { text: finalText, truncated: true }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  if (!llmConfigured()) {
    return NextResponse.json({ error: 'llm_not_configured' }, { status: 503 })
  }

  let body: { productId?: string; objective?: string; tone?: Tone }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.productId) {
    return NextResponse.json({ error: 'productId is required' }, { status: 400 })
  }

  const product = await prisma.product.findFirst({
    where: { id: body.productId, ...ownerFilter(auth) },
    select: {
      id: true,
      name: true,
      description: true,
      mainBenefit: true,
      ingredients: true,
      usageInstruction: true,
    },
  })

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const ceps = await prisma.cep.findMany({
    where: { ...ownerFilter(auth), productId: body.productId, status: 'active' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { cepText: true, painPoint: true, angle: true },
  })

  const objective = body.objective || 'OUTCOME_LEADS'
  const tone = body.tone || 'soft_selling'

  const system = [
    'Kamu copywriter Meta Ads Indonesia.',
    'Balas JSON valid shape: {"variants":[{"primaryText":"...","headline":"...","description":"..."}]}',
    'Buat tepat 3 variant.',
    'Hard rule: primaryText <= 125 chars, headline <= 40 chars, description <= 30 chars.',
    'Jangan pakai markdown. Jangan tambahkan kunci lain.',
  ].join(' ')

  const user = JSON.stringify({
    tone,
    objective,
    product,
    ceps,
    style: 'Bahasa Indonesia, natural, singkat, high-conversion',
  })

  try {
    const data = await llmJson<{ variants?: Array<{ primaryText?: string; headline?: string; description?: string }> }>(system, user, 1200)
    const rawVariants = Array.isArray(data.variants) ? data.variants.slice(0, 3) : []
    const variants = rawVariants.map((variant) => {
      const pt = truncateAtWord(variant.primaryText ?? '', 125)
      const hl = truncateAtWord(variant.headline ?? '', 255)
      const ds = truncateAtWord(variant.description ?? '', 30)
      return {
        primaryText: pt.text,
        headline: hl.text,
        description: ds.text,
        truncated: pt.truncated || hl.truncated || ds.truncated,
      }
    })

    while (variants.length < 3) {
      variants.push({ primaryText: '', headline: '', description: '', truncated: false })
    }

    return NextResponse.json({ variants })
  } catch (error) {
    const message = error instanceof LlmError ? error.message : 'Failed to generate copy'
    const status = error instanceof LlmError && error.status ? error.status : 502
    return NextResponse.json({ error: message }, { status })
  }
}
