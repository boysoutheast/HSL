import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateApiKey, unauthorizedResponse } from '../../_lib/api-key-auth'

export const runtime = 'nodejs'

/**
 * POST /api/internal/meta-media/ensure
 * Creates or finds MetaMediaBinding for a mediaAsset+adAccount.
 * Input: { userId, mediaAssetId, metaAdAccountId, metaImageHash?, metaVideoId? }
 * Returns: existing or newly created MetaMediaBinding
 */
export async function POST(req: NextRequest) {
  if (!validateApiKey(req)) {
    return unauthorizedResponse()
  }

  let body: {
    userId: string
    mediaAssetId: string
    metaAdAccountId: string
    metaImageHash?: string
    metaVideoId?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { userId, mediaAssetId, metaAdAccountId, metaImageHash, metaVideoId } = body

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }
  if (!mediaAssetId) {
    return NextResponse.json({ error: 'mediaAssetId is required' }, { status: 400 })
  }
  if (!metaAdAccountId) {
    return NextResponse.json({ error: 'metaAdAccountId is required' }, { status: 400 })
  }

  try {
    // Verify mediaAsset exists
    const mediaAsset = await prisma.mediaAsset.findUnique({
      where: { id: mediaAssetId },
    })

    if (!mediaAsset) {
      return NextResponse.json({ error: 'MediaAsset not found' }, { status: 404 })
    }

    // Verify metaAdAccount exists
    const metaAdAccount = await prisma.metaAdAccount.findUnique({
      where: { id: metaAdAccountId },
    })

    if (!metaAdAccount) {
      return NextResponse.json({ error: 'MetaAdAccount not found' }, { status: 404 })
    }

    // Check for existing binding
    const existing = await prisma.metaMediaBinding.findUnique({
      where: {
        mediaAssetId_metaAdAccountId: {
          mediaAssetId,
          metaAdAccountId,
        },
      },
    })

    if (existing) {
      // Update hash/video if provided
      if (metaImageHash || metaVideoId) {
        const updated = await prisma.metaMediaBinding.update({
          where: { id: existing.id },
          data: {
            metaImageHash: metaImageHash || existing.metaImageHash,
            metaVideoId: metaVideoId || existing.metaVideoId,
          },
        })
        return NextResponse.json({
          binding: updated,
          created: false,
          existed: true,
        })
      }
      return NextResponse.json({
        binding: existing,
        created: false,
        existed: true,
      })
    }

    // Create new binding
    const binding = await prisma.metaMediaBinding.create({
      data: {
        userId,
        mediaAssetId,
        metaAdAccountId,
        metaImageHash,
        metaVideoId,
        status: 'PENDING',
      },
    })

    return NextResponse.json({
      binding,
      created: true,
      existed: false,
    }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
