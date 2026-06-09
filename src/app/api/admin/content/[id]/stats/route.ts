import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { decode, safeMetaError } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const post = await prisma.metaPost.findUnique({
    where: { id: params.id },
    select: { id: true, metaPostId: true, metaPage: { select: { pageId: true, pageAccessTokenEncrypted: true } } },
  })

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  if (!post.metaPostId) {
    return NextResponse.json({ error: 'Post has no metaPostId — not published on Meta' }, { status: 400 })
  }

  const stats = await prisma.metaPostStat.findMany({
    where: { metaPostId: params.id },
    orderBy: { statDate: 'desc' },
  })

  return NextResponse.json({ stats })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const post = await prisma.metaPost.findUnique({
    where: { id: params.id },
    include: {
      metaPage: {
        select: { id: true, pageId: true, pageAccessTokenEncrypted: true },
      },
    },
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

  if (!post.metaPostId) {
    return NextResponse.json({ error: 'Post has no metaPostId — not published on Meta' }, { status: 400 })
  }

  const pageAccessToken = decode(post.metaPage.pageAccessTokenEncrypted)
  const pageId = post.metaPage.pageId
  const postId = post.metaPostId

  // Fetch insights from Meta Graph API
  const metrics = [
    'post_impressions',
    'post_engaged_users',
    'post_reactions_by_type_total',
    'post_comments',
    'post_shares',
  ].join(',')

  const url = new URL(`https://graph.facebook.com/v21.0/${pageId}/posts`)
  url.searchParams.set('fields', `insights.metric(${metrics})`)
  url.searchParams.set('access_token', pageAccessToken)

  // Use the dedicated insights endpoint: /{post-id}/insights
  const insightsUrl = new URL(`https://graph.facebook.com/v21.0/${postId}/insights`)
  insightsUrl.searchParams.set('metric', metrics)
  insightsUrl.searchParams.set('access_token', pageAccessToken)

  let rawData: Record<string, unknown>
  try {
    const res = await fetch(insightsUrl.toString(), { cache: 'no-store' })
    rawData = await res.json() as Record<string, unknown>

    if (!res.ok || rawData.error) {
      return NextResponse.json({ error: safeMetaError(rawData) }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Failed to reach Meta API' }, { status: 502 })
  }

  // Parse raw insights data
  const data = rawData.data as Array<{ name: string; values: Array<{ value: number | Record<string, number> }> }>
  const statDate = new Date()

  const getValue = (metricName: string): number => {
    const entry = data.find((d) => d.name === metricName)
    if (!entry || !entry.values?.[0]) return 0
    const raw = entry.values[0].value
    return typeof raw === 'number' ? raw : 0
  }

  const impressions = getValue('post_impressions')
  const engagedUsers = getValue('post_engaged_users')
  const reactionsTotal = (() => {
    const entry = data.find((d) => d.name === 'post_reactions_by_type_total')
    if (!entry || !entry.values?.[0]) return 0
    const raw = entry.values[0].value
    if (typeof raw === 'number') return raw
    return Object.values(raw).reduce((sum, v) => sum + v, 0)
  })()
  const comments = getValue('post_comments')
  const shares = getValue('post_shares')

  // Save to MetaPostStat
  const stat = await prisma.metaPostStat.upsert({
    where: {
      metaPostId_statDate: {
        metaPostId: params.id,
        statDate,
      },
    },
    update: {
      impressions,
      reactions: reactionsTotal,
      comments,
      shares,
      rawJson: JSON.stringify(rawData),
    },
    create: {
      metaPostId: params.id,
      statDate,
      impressions,
      reach: 0,
      reactions: reactionsTotal,
      comments,
      shares,
      clicks: engagedUsers,
      rawJson: JSON.stringify(rawData),
    },
  })

  // Update lastSyncedAt on the post
  await prisma.metaPost.update({
    where: { id: params.id },
    data: { lastSyncedAt: new Date() },
  })

  const allStats = await prisma.metaPostStat.findMany({
    where: { metaPostId: params.id },
    orderBy: { statDate: 'desc' },
  })

  return NextResponse.json({ stats: allStats, fresh: stat })
}
