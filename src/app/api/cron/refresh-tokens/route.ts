import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decode, encode } from '@/lib/crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const GRAPH_BASE = 'https://graph.facebook.com/v21.0'
const BATCH_SIZE = 5 // per run, avoid hammering Meta
const RENEW_WINDOW_DAYS = 7

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret')
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const expiryThreshold = new Date(now.getTime() + RENEW_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const checkThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // Find tokens expiring within 7 days OR never checked in 24h
  const candidates = await prisma.metaAccount.findMany({
    where: {
      status: { notIn: ['revoked', 'expired'] },
      longLivedTokenEncrypted: { not: null },
      appSecretEncrypted: { not: null },
      appId: { not: null },
      OR: [
        { tokenExpiry: { lt: expiryThreshold } },
        { lastTokenCheckAt: null },
        { lastTokenCheckAt: { lt: checkThreshold } },
      ],
    },
    select: {
      id: true,
      userId: true,
      appId: true,
      appSecretEncrypted: true,
      longLivedTokenEncrypted: true,
      tokenExpiry: true,
      lastTokenCheckAt: true,
    },
    orderBy: { tokenExpiry: 'asc' as const },
    take: BATCH_SIZE,
  })

  if (candidates.length === 0) {
    return NextResponse.json({ refreshed: 0, skipped: 0, failed: 0, ts: now.toISOString(), message: 'No tokens need refresh' })
  }

  let refreshed = 0
  let skipped = 0
  let failed = 0
  const errors: string[] = []

  for (const acc of candidates) {
    // Check if there's already a pending refresh task
    const existing = await prisma.workerTask.findFirst({
      where: {
        type: 'refresh_token',
        status: { in: ['pending', 'processing'] },
        payloadJson: { contains: `"metaAccountId":"${acc.id}"` },
      },
    })

    if (existing) {
      skipped++
      continue
    }

    // Decrypt token + app secret
    let currentToken: string
    let appSecret: string
    try {
      currentToken = decode(acc.longLivedTokenEncrypted!)
      appSecret = decode(acc.appSecretEncrypted!)
    } catch {
      await prisma.metaAccount.update({
        where: { id: acc.id },
        data: { status: 'needs_reconnect', lastTokenCheckAt: now, tokenExpiry: null },
      })
      failed++
      errors.push(`${acc.id}: decrypt failed → needs_reconnect`)
      continue
    }

    try {
      // Exchange current long-lived token for a new one
      const url = new URL(`${GRAPH_BASE}/oauth/access_token`)
      url.searchParams.set('grant_type', 'fb_exchange_token')
      url.searchParams.set('fb_exchange_token', currentToken)
      url.searchParams.set('client_id', acc.appId!)
      url.searchParams.set('client_secret', appSecret)

      const res = await fetch(url, { cache: 'no-store' })
      const data = await res.json()

      if (!res.ok || data.error) {
        const msg = data?.error?.message ?? data?.error ?? 'Unknown Meta error'
        // Check if token is revoked
        if (msg.includes('revoked') || msg.includes('expired') || msg.includes('invalid token')) {
          await prisma.metaAccount.update({
            where: { id: acc.id },
            data: { status: 'revoked', lastTokenCheckAt: now },
          })
          failed++
          errors.push(`${acc.id}: token revoked`)
        } else {
          await prisma.metaAccount.update({
            where: { id: acc.id },
            data: { lastTokenCheckAt: now },
          })
          failed++
          errors.push(`${acc.id}: ${msg}`)
        }
        continue
      }

      const newToken: string = data.access_token
      const expiresIn: number = data.expires_in ?? 5184000 // default 60 days
      const newExpiry = new Date(now.getTime() + expiresIn * 1000)

      // Store new token encrypted
      await prisma.metaAccount.update({
        where: { id: acc.id },
        data: {
          longLivedTokenEncrypted: encode(newToken),
          tokenExpiry: newExpiry,
          status: 'connected',
          lastTokenCheckAt: now,
          lastMetaCallAt: now,
        },
      })

      refreshed++
    } catch (err) {
      failed++
      errors.push(`${acc.id}: ${err instanceof Error ? err.message : 'fetch error'}`)
    }
  }

  return NextResponse.json({
    refreshed,
    skipped,
    failed,
    total: candidates.length,
    errors: errors.length > 0 ? errors : undefined,
    ts: now.toISOString(),
  })
}
