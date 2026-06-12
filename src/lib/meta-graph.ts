// Meta Graph API helper — MAPI v25.0 (unified Advantage+ structure, Q1 2026)
// Semua call HSL-side ke graph.facebook.com lewat sini supaya versi konsisten.
import { prisma } from '@/lib/prisma'
import { decode } from '@/lib/crypto'

export const META_API_VERSION = 'v25.0'
const GRAPH_BASE = `https://graph.facebook.com/${META_API_VERSION}`

export class MetaGraphError extends Error {
  code?: number
  constructor(message: string, code?: number) {
    super(message)
    this.code = code
  }
}

interface GraphErrorBody {
  error?: { message?: string; code?: number }
}

export function normalizeMetaAdAccountPath(adAccountId: string): string {
  const clean = adAccountId.trim()
  if (!clean) return clean
  return clean.startsWith('act_') ? clean : `act_${clean}`
}

export async function graphFetch<T = unknown>(
  path: string,
  accessToken: string,
  opts?: { method?: 'GET' | 'POST' | 'DELETE'; params?: Record<string, string>; body?: Record<string, unknown> }
): Promise<T> {
  const method = opts?.method ?? 'GET'
  const url = new URL(`${GRAPH_BASE}/${path.replace(/^\//, '')}`)
  url.searchParams.set('access_token', accessToken)
  for (const [k, v] of Object.entries(opts?.params ?? {})) {
    url.searchParams.set(k, v)
  }

  const res = await fetch(url.toString(), {
    method,
    headers: opts?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  })

  const data = (await res.json().catch(() => ({}))) as T & GraphErrorBody
  if (!res.ok || data.error) {
    throw new MetaGraphError(
      data.error?.message ?? `Meta API error (HTTP ${res.status})`,
      data.error?.code
    )
  }
  return data
}

/** Ambil long-lived token (decrypted) dari MetaAccount milik user. */
export async function getMetaToken(userId: string, metaAccountId?: string): Promise<{ token: string; accountId: string } | null> {
  const account = await prisma.metaAccount.findFirst({
    where: {
      userId,
      status: 'connected',
      ...(metaAccountId ? { id: metaAccountId } : {}),
      longLivedTokenEncrypted: { not: null },
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, longLivedTokenEncrypted: true },
  })
  if (!account?.longLivedTokenEncrypted) return null
  try {
    return { token: decode(account.longLivedTokenEncrypted), accountId: account.id }
  } catch (err) {
    console.error(`[meta-graph] token decode failed for user ${userId} (key rotation?):`, err)
    return null
  }
}

// ── CAPI ──────────────────────────────────────────────────────────────────────

export interface CapiUserData {
  em?: string[] // hashed email
  ph?: string[] // hashed phone
  client_ip_address?: string
  client_user_agent?: string
  fbc?: string
  fbp?: string
  external_id?: string[]
}

export interface CapiEvent {
  event_name: string
  event_time: number // unix seconds
  event_id?: string
  event_source_url?: string
  action_source: 'website' | 'app' | 'physical_store' | 'system_generated' | 'other'
  user_data: CapiUserData
  custom_data?: Record<string, unknown>
}

/** Kirim conversion events ke Meta CAPI. */
export async function sendCapiEvents(
  pixelId: string,
  accessToken: string,
  events: CapiEvent[],
  testEventCode?: string | null
): Promise<{ events_received?: number; fbtrace_id?: string }> {
  return graphFetch(`${pixelId}/events`, accessToken, {
    method: 'POST',
    body: {
      data: events,
      ...(testEventCode ? { test_event_code: testEventCode } : {}),
    },
  })
}
