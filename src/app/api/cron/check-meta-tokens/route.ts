/**
 * POST /api/cron/check-meta-tokens
 *
 * Proactive token health check.
 * Tiap 6 jam: per MetaAccount status='connected', cek via debug_token endpoint.
 * Update tokenExpiry, lastTokenCheckAt, status.
 * Kalau invalid (error 190) → status='needs_reconnect'.
 * Kalau < 7 hari ke expiry → tetap connected, flag via expiry.
 *
 * Auth: x-cron-secret (CRON_SECRET env)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decode } from '@/lib/crypto'
import { metaGet, TokenError } from '@/lib/meta-client'
import { notify } from '@/lib/notify'

export const dynamic = 'force-dynamic'

const LIMIT = 50

function checkAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('x-cron-secret') === secret
    || req.headers.get('authorization') === `Bearer ${secret}`
}

function decryptToken(encrypted: string): string {
  return decode(encrypted)
}

async function run() {
  const now = new Date()

  // Only check connected accounts
  const accounts = await prisma.metaAccount.findMany({
    where: { status: 'connected' },
    take: LIMIT,
    orderBy: { lastTokenCheckAt: { sort: 'asc', nulls: 'first' } },
    select: { id: true, userId: true, longLivedTokenEncrypted: true, tokenExpiry: true, lastTokenCheckAt: true },
  })

  let checked = 0
  let healthy = 0
  let needsReconnect = 0
  let skipped = 0

  for (const account of accounts) {
    if (!account.longLivedTokenEncrypted) {
      skipped++
      continue
    }

    let token: string
    try {
      token = decryptToken(account.longLivedTokenEncrypted)
    } catch {
      // Can't decrypt → mark as needs_reconnect
      await prisma.metaAccount.update({
        where: { id: account.id },
        data: { status: 'needs_reconnect', lastTokenCheckAt: now },
      })
      needsReconnect++
      await notify(account.userId, {
        type: 'token_expired',
        severity: 'error',
        title: 'Token Meta Ads kadaluwarsa',
        body: 'Token tidak bisa didekripsi. Hubungkan ulang akun Meta.',
        refType: 'meta_account',
        refId: account.id,
      }).catch(() => {})
      continue
    }

    try {
      // Use debug_token to verify token validity and get expiry
      // This also serves as a lightweight health check
      const { data } = await metaGet('/me', token, { fields: 'id' })
      const meData = data as { id: string }

      // Token is valid — update lastTokenCheckAt
      await prisma.metaAccount.update({
        where: { id: account.id },
        data: { lastTokenCheckAt: now, lastMetaCallAt: now },
      })

      // Try to get token expiry via debug_token
      try {
        const { data: debugData } = await metaGet('debug_token', token, { input_token: token })
        const tokInfo = (debugData as any)?.data
        if (tokInfo?.expires_at) {
          const expiry = new Date(tokInfo.expires_at * 1000)
          await prisma.metaAccount.update({
            where: { id: account.id },
            data: { tokenExpiry: expiry },
          })
        }
      } catch {
        // debug_token may fail for some token types — that's fine
      }

      healthy++
      checked++
    } catch (err) {
      const msg = String(err)
      // Token invalid/expired (error 190 in TokenError)
      if (err instanceof TokenError || msg.includes('190') || msg.includes('OAuthException')) {
        await prisma.metaAccount.update({
          where: { id: account.id },
          data: { status: 'needs_reconnect', lastTokenCheckAt: now },
        })
        needsReconnect++
        await notify(account.userId, {
          type: 'token_expired',
          severity: 'error',
          title: 'Token Meta Ads tidak valid',
          body: 'Meta API menolak token. Hubungkan ulang akun Meta.',
          refType: 'meta_account',
          refId: account.id,
        }).catch(() => {})
      } else {
        // Network/temp error — skip for now
        skipped++
      }
      checked++
    }
  }

  return { checked, healthy, needsReconnect, skipped, totalRemaining: accounts.length }
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' })
  }
  try {
    const result = await run()
    return NextResponse.json({ ok: true, ...result, ts: new Date().toISOString() })
  } catch (err) {
    console.error('[check-meta-tokens] Error:', err)
    return NextResponse.json({ ok: false, error: 'Internal error', ts: new Date().toISOString() })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
