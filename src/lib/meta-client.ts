/**
 * meta-client.ts — Centralized Meta Graph API client (v25.0)
 *
 * Semua call Meta lewat sini. Wajib patuh Graph API v25.0 spec.
 * Auth: Authorization: Bearer header (BUKAN access_token di URL — token jangan ke log).
 *
 * Meta Compliance Checklist (v25.0):
 * - Budget unit: Meta pakai minor currency unit. IDR = zero-decimal → kirim integer rupiah.
 * - Status enum: hanya `ACTIVE`/`PAUSED` (capitalized). Bukan lowercase.
 * - publisher_platforms wajib eksplisit kalau bikin/ubah placement.
 * - insight purchase_roas = array [{action_type, value}] — parse hati-hati.
 * - Pagination: follow paging.next untuk multi-page.
 * - Endpoint: graph.facebook.com/v25.0
 */

const GRAPH = 'https://graph.facebook.com/v25.0'

// ── Error Types ──────────────────────────────────────────

export class TokenError extends Error {
  constructor(msg: string) { super(msg); this.name = 'TokenError' }
}
export class RateLimitError extends Error {
  constructor(msg: string) { super(msg); this.name = 'RateLimitError' }
}

// ── Rate-limit tracking — per-call, soft state ────────────

let lastUsagePct = 0

function readUsageHeaders(headers: Headers): number {
  // X-Business-Use-Case-Usage & X-App-Usage
  const usageJson = headers.get('X-Business-Use-Case-Usage')
    ?? headers.get('X-App-Usage')
  if (usageJson) {
    try {
      const parsed = JSON.parse(usageJson)
      // Various shapes: { call_count: 80, total_cputime: 60, total_time: 55 }
      const vals = typeof parsed === 'object'
        ? Object.values(parsed).filter(v => typeof v === 'number') as number[]
        : []
      const pct = vals.length > 0 ? Math.max(...vals) : 0
      lastUsagePct = pct
      return pct
    } catch { /* ignore */ }
  }
  return 0
}

function getBackoffMs(attempt: number, usagePct: number): number {
  if (usagePct > 90) return Math.min(60_000 * (1 + attempt), 300_000) // heavy backoff
  return Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 60_000) // exponential
}

// ── Core helpers ──────────────────────────────────────────

async function request(
  method: 'GET' | 'POST',
  path: string,
  token: string,
  body?: URLSearchParams | Record<string, unknown>,
): Promise<{ data: unknown; headers: Headers }> {
  const url = path.startsWith('http') ? path : `${GRAPH}${path.startsWith('/') ? '' : '/'}${path}`

  const opts: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
  }

  if (method === 'POST' && body) {
    opts.body = body instanceof URLSearchParams
      ? body
      : new URLSearchParams(body as Record<string, string>)
  }

  const res = await fetch(url, opts)

  // Rate limit detection (error code 17/4/32/613)
  const usagePct = readUsageHeaders(res.headers)
  if (res.status === 429 || [17, 4, 32, 613].includes(res.status)) {
    throw new RateLimitError(`Rate limited: HTTP ${res.status}, usage ${usagePct}%`)
  }

  // Token invalid
  if (res.status === 401) {
    const errBody = await res.json().catch(() => ({}))
    if (errBody?.error?.code === 190) {
      throw new TokenError(errBody.error.message ?? 'Token invalid/expired')
    }
  }

  const data = await res.json()

  if (!res.ok) {
    const code = data?.error?.code
    const msg = data?.error?.message ?? `Meta API error: HTTP ${res.status}`
    if (code >= 17 && code <= 613) throw new RateLimitError(msg)
    throw new Error(msg)
  }

  return { data, headers: res.headers }
}

/**
 * Fetch with auto-retry and exponential backoff (max 3 attempts).
 * Tokens NEVER logged.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  attempt = 1,
  maxAttempts = 3,
): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (
      attempt >= maxAttempts
      || (!(err instanceof RateLimitError) && !(err instanceof TokenError) && (err as Error).message.includes('429'))
    ) throw err
    if (err instanceof TokenError) throw err // don't retry invalid tokens

    const backoff = getBackoffMs(attempt, lastUsagePct)
    console.warn(`[meta-client] retry ${attempt}/${maxAttempts} backing off ${backoff}ms: ${(err as Error).message}`)
    await new Promise(r => setTimeout(r, backoff))
    return withRetry(fn, attempt + 1, maxAttempts)
  }
}

// ── Public API ────────────────────────────────────────────

/** GET dengan retry + backoff. path: relative (/act_xxx/campaigns) */
export async function metaGet(path: string, token: string, params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return withRetry(() => request('GET', `${path}${qs}`, token))
}

/** POST (write) dengan retry. body: flat key-value. */
export async function metaPost(path: string, token: string, body: Record<string, unknown>) {
  return withRetry(() => request('POST', path, token, body))
}

// ── Helper: getCampaignStructure ──────────────────────────
// Get campaign + adsets + ads in one tree, with pagination.

interface CampaignNode {
  id: string
  name: string
  status: string
  [key: string]: unknown
}

export async function getCampaignStructure(
  adAccountId: string,
  campaignId: string,
  token: string,
): Promise<{ campaign: CampaignNode; adsets: CampaignNode[]; ads: CampaignNode[] }> {
  // Fields per Graph API v25.0 — /campaign?fields=name,status,adsets{name,status,ads{id,name,status,creative{id}}}
  const fields = `id,name,status,effective_status,daily_budget,lifetime_budget,budget_remaining,adsets{id,name,status,effective_status,daily_budget,lifetime_budget,targeting{targeted_interest_ids,targeted_relaxation},ads{id,name,status,effective_status,creative{id,asset_feed_spec,object_story_spec}}}`

  const { data } = await metaGet(`/${campaignId}`, token, { fields })
  const campaign = data as CampaignNode

  // Parse adsets + ads with pagination
  const adsets: CampaignNode[] = []
  const ads: CampaignNode[] = []
  let adsetData = (campaign as any).adsets?.data ?? []
  let adsetPaging = (campaign as any).adsets?.paging

  while (adsetData?.length > 0) {
    for (const as of adsetData) {
      adsets.push(as)
      // Collect ads from this adset
      let adItems = as.ads?.data ?? []
      let adPaging = as.ads?.paging
      while (adItems?.length > 0) {
        for (const ad of adItems) ads.push(ad)
        if (adPaging?.next) {
          const { data: nextData } = await metaGet(adPaging.next, token)
          adItems = (nextData as any).data ?? []
          adPaging = (nextData as any).paging
        } else break
      }
    }
    if (adsetPaging?.next) {
      const { data: nextData } = await metaGet(adsetPaging.next, token)
      adsetData = (nextData as any).data ?? []
      adsetPaging = (nextData as any).paging
    } else break
  }

  return { campaign, adsets, ads }
}

// ── Helper: getInsights ───────────────────────────────────
// Get spend, actions, purchase_roas, cpc, ctr, impressions.

export interface InsightResult {
  spend: number
  impressions: number
  clicks: number
  cpc: number | null
  ctr: number | null
  purchases: number
  purchaseValue: number
  purchaseRoas: number | null
}

export async function getInsights(
  entityId: string,
  token: string,
  datePreset: string = 'maximum',
): Promise<InsightResult> {
  const fields = 'spend,impressions,clicks,cpc,ctr,actions{purchase_roas},action_values{purchase_roas}'
  const { data } = await metaGet(`/${entityId}/insights`, token, {
    fields,
    date_preset: datePreset,
    level: 'ad',
    limit: '50',
  })

  const rows = (data as any)?.data ?? []

  // Aggregate over all rows
  let spend = 0, impressions = 0, clicks = 0
  let purchases = 0, purchaseValue = 0
  const roasValues: number[] = []

  for (const row of rows) {
    spend += Number(row.spend ?? 0)
    impressions += Number(row.impressions ?? 0)
    clicks += Number(row.clicks ?? 0)

    // Parse actions array for purchase_roas
    // purchase_roas = array of {action_type, value}
    const actions: Array<{ action_type: string; value: number }> = row.actions ?? []
    for (const a of actions) {
      if (a.action_type === 'purchase_roas' && a.value) {
        roasValues.push(Number(a.value))
      }
    }

    // Parse action_values for purchase value
    const actionValues: Array<{ action_type: string; value: number }> = row.action_values ?? []
    for (const av of actionValues) {
      if (av.action_type === 'purchase' && av.value) {
        purchaseValue += Number(av.value)
      }
    }

    // Count purchases from standard actions
    const stdActions: Array<{ action_type: string; value: number }> = row.actions ?? []
    for (const sa of stdActions) {
      if (sa.action_type === 'purchase' && sa.value) {
        purchases += Math.round(Number(sa.value))
      }
    }
  }

  const cpc = clicks > 0 ? spend / clicks : null
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : null
  const purchaseRoas = roasValues.length > 0
    ? roasValues.reduce((a, b) => a + b, 0) / roasValues.length
    : null

  return { spend, impressions, clicks, cpc, ctr, purchases, purchaseValue, purchaseRoas }
}

// ── Helper: updateBudget ──────────────────────────────────
// PATCH daily_budget. UNIT: integer rupiah (IDR zero-decimal).

export async function updateBudget(
  entityId: string,
  dailyBudgetMinor: number,
  token: string,
): Promise<void> {
  // IDR = zero-decimal currency → integer rupiah langsung
  await metaPost(`/${entityId}`, token, {
    daily_budget: String(dailyBudgetMinor),
    access_token: undefined!, // override: we use Bearer, not in URL
  })
}

// ── Helper: setStatus ─────────────────────────────────────
// ACTIVE / PAUSED. Capitalized per v25.0 spec.

export async function setStatus(
  entityId: string,
  status: 'ACTIVE' | 'PAUSED',
  token: string,
): Promise<void> {
  await metaPost(`/${entityId}`, token, { status })
}

// ── Helper: createAd ──────────────────────────────────────
// Create ad in PAUSED state. publisher_platforms eksplisit.

export interface AdCreativeSpec {
  name: string
  adsetId: string
  primaryText: string
  headline: string
  description?: string
  callToAction: string // Meta CTA enum
  linkUrl: string
  mediaAssetId?: string | null
  creativeUrl?: string | null
  status?: 'ACTIVE' | 'PAUSED'
  publisherPlatforms?: ('facebook' | 'instagram' | 'messenger' | 'audience_network')[]
}

export async function createAd(
  spec: AdCreativeSpec,
  token: string,
): Promise<{ adId: string; creativeId: string }> {
  const publisherPlatforms = spec.publisherPlatforms ?? ['facebook', 'instagram']

  // Step 1: Create creative
  const creativeBody: Record<string, unknown> = {
    name: `AD: ${spec.name}`,
    object_story_spec: {
      page_id: '', // will be set by account context — we keep minimal
      link_data: {
        link: spec.linkUrl,
        message: spec.primaryText,
        name: spec.headline,
        description: spec.description ?? '',
        call_to_action: { type: spec.callToAction },
      },
    },
    publisher_platforms: publisherPlatforms,
    degrees_of_freedom_spec: {
      creative_features_spec: {
        standard_enhancements: { enroll_status: 'OPT_OUT' },
      },
    },
  }

  // If we have a media asset, attach as photo
  if (spec.mediaAssetId) {
    creativeBody.object_story_spec.link_data.attachment_hash = spec.mediaAssetId
  } else if (spec.creativeUrl) {
    creativeBody.object_story_spec.link_data.link = spec.creativeUrl
  }

  const { data: creative } = await metaPost(
    `/act_${spec.adsetId.split('_')[0]}/adcreatives`,
    token,
    { ...creativeBody, access_token: undefined! },
  )
  const creativeData = creative as { id: string }

  // Step 2: Create ad (PAUSED by default)
  const status = spec.status ?? 'PAUSED'
  const { data: ad } = await metaPost(
    `/act_${spec.adsetId.split('_')[0]}/ads`,
    token,
    {
      name: spec.name,
      adset_id: spec.adsetId,
      creative: { creative_id: creativeData.id },
      status,
      access_token: undefined!,
    },
  )
  const adData = ad as { id: string }

  return { adId: adData.id, creativeId: creativeData.id }
}
