import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { decode } from '@/lib/crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAPI_VERSION = 'v25.0'
const GRAPH_BASE = `https://graph.facebook.com/${MAPI_VERSION}`

interface MetaCampaign {
  id: string
  name: string
  status: string
  daily_budget?: string
  objective?: string
  adsets?: { data: Array<{ id: string }> }
}

interface MetaGraphResponse<T> {
  data: T[]
  error?: { message: string; code?: number }
}

/**
 * GET /api/admin/meta-campaigns?metaAdAccountId=<id>
 * List existing Meta campaigns that haven't been imported yet.
 * Falls back to direct Meta API query — no worker dependency.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const metaAdAccountId = searchParams.get('metaAdAccountId')

  if (!metaAdAccountId) {
    return NextResponse.json({ error: 'metaAdAccountId is required' }, { status: 400 })
  }

  // Find the ad account + parent meta account for token
  const adAccount = await prisma.metaAdAccount.findFirst({
    where: {
      id: metaAdAccountId,
      ...(auth.role === 'admin' ? {} : { metaAccount: { userId: auth.id } }),
    },
    select: {
      id: true,
      adAccountId: true,
      metaAccount: {
        select: {
          id: true,
          userId: true,
          longLivedTokenEncrypted: true,
        },
      },
    },
  })

  if (!adAccount) {
    return NextResponse.json({ error: 'Ad account not found' }, { status: 404 })
  }

  let token: string
  try {
    if (!adAccount.metaAccount.longLivedTokenEncrypted) {
      return NextResponse.json({ error: 'No Meta token available. Reconnect Meta account.' }, { status: 400 })
    }
    token = decode(adAccount.metaAccount.longLivedTokenEncrypted)
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt Meta token. Reconnect Meta account.' }, { status: 400 })
  }

  // Fetch existing CampaignSessions for this user to filter out already-imported campaigns
  const existingSessions = await prisma.campaignSession.findMany({
    where: {
      userId: auth.id,
      metaCampaignId: { not: null },
    },
    select: { metaCampaignId: true },
  })
  const importedIds = new Set(existingSessions.map((s) => s.metaCampaignId))

  // Query Meta for campaigns
  try {
    const fields = 'id,name,status,daily_budget,objective,adsets.limit(1){id}'
    const url = new URL(`${GRAPH_BASE}/act_${adAccount.adAccountId}/campaigns`)
    url.searchParams.set('access_token', token)
    url.searchParams.set('fields', fields)
    url.searchParams.set('limit', '100')

    const res = await fetch(url.toString(), { cache: 'no-store' })
    const data: MetaGraphResponse<MetaCampaign> = await res.json().catch(() => ({ data: [] }))

    if (!res.ok || data.error) {
      return NextResponse.json({
        error: data.error?.message ?? `Meta API error (HTTP ${res.status})`,
        code: data.error?.code,
      }, { status: res.status })
    }

    const campaigns = data.data.map((c) => ({
      metaCampaignId: c.id,
      name: c.name,
      status: c.status,
      dailyBudget: c.daily_budget ? parseInt(c.daily_budget, 10) : 0,
      objective: c.objective ?? 'UNKNOWN',
      adsetCount: c.adsets?.data?.length ?? 0,
      alreadyImported: importedIds.has(c.id),
    }))

    // Sort: not-yet-imported first, then by name
    campaigns.sort((a, b) => {
      if (a.alreadyImported !== b.alreadyImported) return a.alreadyImported ? 1 : -1
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({ campaigns })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[meta-campaigns] Error:', message)
    return NextResponse.json({ error: 'Failed to fetch campaigns from Meta' }, { status: 500 })
  }
}
