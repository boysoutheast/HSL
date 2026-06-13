import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decode, encode, safeMetaError } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/refresh-tokens
 * Cron job (x-cron-secret auth) that:
 * 1. Finds tokens expiring within 7 days → attempts refresh via Meta API
 * 2. Finds tokens not checked in 7 days → debug_token to verify status
 * 3. Updates MetaAccount status: connected | expired | needs_reconnect | revoked
 *
 * Batch size limited to avoid Meta rate limits. Cron runs hourly.
 */
export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret')
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const BATCH_SIZE = 10 // Process max 10 per run to avoid rate limits

  const results = {
    refreshed: 0,
    stillValid: 0,
    needsReconnect: 0,
    expired: 0,
    errors: [] as string[],
  }

  // ── Phase 1: Refresh tokens expiring within 7 days ──
  const expiringTokens = await prisma.metaAccount.findMany({
    where: {
      status: 'connected',
      tokenExpiry: { not: null, lte: sevenDaysFromNow },
      appId: { not: null },
      appSecretEncrypted: { not: null },
      longLivedTokenEncrypted: { not: null },
    },
    select: {
      id: true,
      appId: true,
      appSecretEncrypted: true,
      longLivedTokenEncrypted: true,
    },
    take: BATCH_SIZE,
  })

  for (const account of expiringTokens) {
    try {
      const appSecret = decode(account.appSecretEncrypted!)
      const longLivedToken = decode(account.longLivedTokenEncrypted!)

      // Exchange long-lived token for a fresh long-lived token
      const url = new URL('https://graph.facebook.com/v21.0/oauth/access_token')
      url.searchParams.set('grant_type', 'fb_exchange_token')
      url.searchParams.set('client_id', account.appId!)
      url.searchParams.set('client_secret', appSecret)
      url.searchParams.set('fb_exchange_token', longLivedToken)

      const res = await fetch(url, { cache: 'no-store' })
      const data = await res.json()

      if (!res.ok) {
        const errMsg = safeMetaError(data)
        results.errors.push(`refresh ${account.id}: ${errMsg}`)

        // If token is invalid/expired, mark needs_reconnect
        if (data?.error?.code === 190 || data?.error?.error_subcode === 463) {
          await prisma.metaAccount.update({
            where: { id: account.id },
            data: { status: 'needs_reconnect', lastTokenCheckAt: now },
          })
          results.needsReconnect++
        }
        continue
      }

      const newToken = data.access_token as string | undefined
      const expiresInSeconds = data.expires_in as number | undefined

      if (newToken) {
        const newExpiry = expiresInSeconds
          ? new Date(now.getTime() + expiresInSeconds * 1000)
          : null

        await prisma.metaAccount.update({
          where: { id: account.id },
          data: {
            longLivedTokenEncrypted: encode(newToken),
            tokenExpiry: newExpiry,
            lastTokenCheckAt: now,
            lastMetaCallAt: now,
            status: 'connected',
          },
        })
        results.refreshed++
      } else {
        results.stillValid++
      }
    } catch (e) {
      results.errors.push(`refresh ${account.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ── Phase 2: Health check tokens not checked in 7 days ──
  const staleTokens = await prisma.metaAccount.findMany({
    where: {
      status: 'connected',
      OR: [
        { lastTokenCheckAt: null },
        { lastTokenCheckAt: { lt: sevenDaysAgo } },
      ],
      // Exclude accounts already processed in Phase 1
      id: { notIn: expiringTokens.map(a => a.id) },
      appId: { not: null },
      appSecretEncrypted: { not: null },
    },
    select: {
      id: true,
      appId: true,
      appSecretEncrypted: true,
      longLivedTokenEncrypted: true,
      shortLivedTokenEncrypted: true,
    },
    take: BATCH_SIZE,
  })

  for (const account of staleTokens) {
    try {
      const appSecret = decode(account.appSecretEncrypted!)
      const token = account.longLivedTokenEncrypted
        ? decode(account.longLivedTokenEncrypted)
        : account.shortLivedTokenEncrypted
          ? decode(account.shortLivedTokenEncrypted)
          : null

      if (!token) {
        await prisma.metaAccount.update({
          where: { id: account.id },
          data: { status: 'needs_reconnect', lastTokenCheckAt: now },
        })
        results.needsReconnect++
        continue
      }

      // Debug token to check validity
      const url = new URL('https://graph.facebook.com/v21.0/debug_token')
      url.searchParams.set('input_token', token)
      url.searchParams.set('access_token', `${account.appId}|${appSecret}`)

      const res = await fetch(url, { cache: 'no-store' })
      const data = await res.json()

      if (!res.ok || !data?.data?.is_valid) {
        // Token is invalid
        const errCode = data?.error?.code
        const errSubcode = data?.error?.error_subcode

        let newStatus = 'needs_reconnect'
        if (errCode === 190 && errSubcode === 463) {
          newStatus = 'expired'
        } else if (errCode === 190) {
          newStatus = 'revoked'
        }

        await prisma.metaAccount.update({
          where: { id: account.id },
          data: { status: newStatus, lastTokenCheckAt: now },
        })

        if (newStatus === 'expired') results.expired++
        else results.needsReconnect++
        continue
      }

      // Token is valid — update lastTokenCheckAt and expiry if available
      const tokenData = data.data
      const newExpiry = tokenData.expires_at
        ? new Date(tokenData.expires_at * 1000)
        : null

      await prisma.metaAccount.update({
        where: { id: account.id },
        data: {
          lastTokenCheckAt: now,
          status: 'connected',
          ...(newExpiry ? { tokenExpiry: newExpiry } : {}),
        },
      })
      results.stillValid++
    } catch (e) {
      results.errors.push(`health ${account.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return NextResponse.json({
    ...results,
    ts: now.toISOString(),
    total: results.refreshed + results.stillValid + results.needsReconnect + results.expired,
  })
}
