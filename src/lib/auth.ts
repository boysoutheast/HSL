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

// Worker auth: only agents flagged is_worker may use /api/worker/* endpoints.
// Content agents (Hermes utama, Digipro, dll) are rejected here.
export async function validateWorkerApiKey(apiKey: string) {
  const agent = await validateHermesApiKey(apiKey)
  if (!agent || !agent.isWorker) return null
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

/**
 * Assert that a MetaConnection (metaAccount) belongs to the authenticated user.
 * Returns the connection or a 404 NextResponse.
 */
export async function assertOwnsConnection(
  user: SessionUser,
  connectionId: string,
): Promise<NextResponse | { id: string; userId: string; longLivedTokenEncrypted: string | null; shortLivedTokenEncrypted: string | null }> {
  if (user.role === 'admin') {
    const conn = await prisma.metaAccount.findUnique({
      where: { id: connectionId },
      select: { id: true, userId: true, longLivedTokenEncrypted: true, shortLivedTokenEncrypted: true },
    })
    if (!conn) return NextResponse.json({ error: 'MetaConnection not found' }, { status: 404 })
    return conn
  }
  const conn = await prisma.metaAccount.findFirst({
    where: { id: connectionId, userId: user.id },
    select: { id: true, userId: true, longLivedTokenEncrypted: true, shortLivedTokenEncrypted: true },
  })
  if (!conn) return NextResponse.json({ error: 'MetaConnection not found' }, { status: 404 })
  return conn
}

/**
 * Assert that a MetaAdAccount belongs to the authenticated user (via its parent MetaConnection).
 * Returns the ad account or a 404 NextResponse.
 */
export async function assertOwnsAdAccount(
  user: SessionUser,
  adAccountId: string,
): Promise<NextResponse | { id: string; adAccountId: string; metaAccountId: string; adAccountName: string | null; currency: string | null; metaAccount: { id: string; userId: string; longLivedTokenEncrypted: string | null; shortLivedTokenEncrypted: string | null } }> {
  if (user.role === 'admin') {
    const ad = await prisma.metaAdAccount.findUnique({
      where: { id: adAccountId },
      select: { id: true, adAccountId: true, adAccountName: true, currency: true, metaAccountId: true, metaAccount: { select: { id: true, userId: true, longLivedTokenEncrypted: true, shortLivedTokenEncrypted: true } } },
    })
    if (!ad) return NextResponse.json({ error: 'Ad account not found' }, { status: 404 })
    return ad
  }
  const ad = await prisma.metaAdAccount.findFirst({
    where: { id: adAccountId, metaAccount: { userId: user.id } },
    select: { id: true, adAccountId: true, adAccountName: true, currency: true, metaAccountId: true, metaAccount: { select: { id: true, userId: true, longLivedTokenEncrypted: true, shortLivedTokenEncrypted: true } } },
  })
  if (!ad) return NextResponse.json({ error: 'Ad account not found' }, { status: 404 })
  return ad
}
