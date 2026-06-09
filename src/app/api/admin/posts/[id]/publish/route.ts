import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { decode, safeMetaError } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const post = await prisma.metaPost.findUnique({
    where: { id: params.id },
    include: { metaPage: true },
  })

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  if (!post.metaPage) {
    return NextResponse.json({ error: 'Post has no associated MetaPage' }, { status: 400 })
  }

  if (!post.metaPage.pageAccessTokenEncrypted) {
    return NextResponse.json({ error: 'Page has no access token' }, { status: 400 })
  }

  const pageAccessToken = decode(post.metaPage.pageAccessTokenEncrypted)
  const pageId = post.metaPage.pageId

  // Build Graph API payload
  const graphPayload: Record<string, string> = {
    message: post.message ?? '',
  }

  if (post.mediaUrlsJson) {
    try {
      const mediaUrls = JSON.parse(post.mediaUrlsJson) as string[]
      if (mediaUrls.length > 0) {
        graphPayload.url = mediaUrls[0]
      }
    } catch {
      // ignore malformed mediaUrlsJson
    }
  }

  if (post.linkUrl) {
    graphPayload.link = post.linkUrl
  }

  let metaPostId: string

  try {
    const graphRes = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}/feed`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pageAccessToken}`,
        },
        body: JSON.stringify(graphPayload),
      },
    )

    const data = await graphRes.json() as { id?: string; error?: unknown }

    if (!graphRes.ok || data.error) {
      const errorMessage = safeMetaError(data)
      await prisma.metaPost.update({
        where: { id: params.id },
        data: { status: 'failed' },
      })
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    metaPostId = data.id ?? ''
  } catch (err) {
    await prisma.metaPost.update({
      where: { id: params.id },
      data: { status: 'failed' },
    })
    return NextResponse.json({ error: 'Failed to reach Meta API' }, { status: 502 })
  }

  const updated = await prisma.metaPost.update({
    where: { id: params.id },
    data: {
      status: 'published',
      metaPostId,
      publishedAt: new Date(),
    },
  })

  return NextResponse.json({ success: true, metaPostId, post: updated })
}
