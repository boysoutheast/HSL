import { NextRequest, NextResponse } from 'next/server'
import { prisma } from './prisma'
import { createHash } from 'crypto'
import { getSessionUser, SessionUser } from './session'

// ── Hermes API key auth (unchanged) ─────────────────────────────────────────

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export async function validateHermesApiKey(apiKey: string) {
  const hash = hashApiKey(apiKey)
  const agent = await prisma.hermesAgent.findUnique({
    where: { apiKeyHash: hash },
  })
  if (!agent || agent.status !== 'active') return null
  return agent
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  return authHeader.slice(7).trim()
}

// ── Admin session auth ───────────────────────────────────────────────────────

export type { SessionUser }

/** Require a valid session. Returns the user or a 401 NextResponse. */
export async function requireAuth(req: NextRequest): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return user
}

/** Require admin role. Returns the user or a 401/403 NextResponse. */
export async function requireAdmin(req: NextRequest): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return user
}

/**
 * Build a Prisma where-clause fragment for ownership filtering.
 * admin → no filter (sees everything)
 * user  → filter by createdByUserId
 */
export function ownerFilter(
  user: SessionUser,
  field: string = 'createdByUserId',
): Record<string, unknown> {
  if (user.role === 'admin') return {}
  return { [field]: user.id }
}

/** Verify user owns Meta connection before sensitive read/write. */
export async function assertOwnsConnection(user: SessionUser, connectionId: string) {
  const metaAccount = await prisma.metaAccount.findFirst({
    where: {
      id: connectionId,
      ...(user.role === 'admin' ? {} : { userId: user.id }),
    },
    select: {
      id: true,
      userId: true,
      longLivedTokenEncrypted: true,
      shortLivedTokenEncrypted: true,
    },
  })

  if (!metaAccount) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  return metaAccount
}

/** Verify user owns Meta ad account before Graph proxy calls. */
export async function assertOwnsAdAccount(user: SessionUser, adAccountId: string) {
  const adAccount = await prisma.metaAdAccount.findFirst({
    where: {
      id: adAccountId,
      ...(user.role === 'admin' ? {} : { metaAccount: { userId: user.id } }),
    },
    select: {
      id: true,
      metaAccountId: true,
      metaAccount: {
        select: {
          id: true,
          userId: true,
          longLivedTokenEncrypted: true,
          shortLivedTokenEncrypted: true,
        },
      },
    },
  })

  if (!adAccount) {
    return NextResponse.json({ error: 'Ad account not found' }, { status: 404 })
  }

  return adAccount
}
