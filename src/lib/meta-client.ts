/**
 * meta-client.ts — Centralized Meta Graph API client (v25.0)
 *
 * ... (same header, omitted for space)
 */

const GRAPH = 'https://graph.facebook.com/v25.0'

// ── Error Types ──────────────────────────────────────────

export class TokenError extends Error {
  constructor(msg: string) { super(msg); this.name = 'TokenError' }
}
export class RateLimitError extends Error {
  constructor(msg: string) { super(msg); this.name = 'RateLimitError' }
}

// ── Rate-limit tracking ──────────────────────────

let lastUsagePct = 0

function readUsageHeaders(headers: Headers): number {
  const usageJson = headers.get('X-Business-Use-Case-Usage')
    ?? headers.get('X-App-Usage')
  if (usageJson) {
    try {
      const parsed = JSON.parse(usageJson)
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
  if (usagePct > 90) return Math.min(60_000 * (1 + attempt), 300_000)
  return Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 60_000)
}

// ── Core helpers ──────────────────────────────────────────

async function request(
  method: 'GET' | 'POST',
  path: string,
  token: string,
  body?: URLSearchParams | Record<string, string>,
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

  const usagePct = readUsageHeaders(res.headers)
  if (res.status === 429 || [17, 4, 32, 613].includes(res.status)) {
    throw new RateLimitError(`Rate limited: HTTP ${res.status}, usage ${usagePct}%`)
  }

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
    // Token errors → TokenError (memicu needs_reconnect). 190 + OAuth subcodes.
    if (code === 190 || code === 102 || code === 463 || code === 467) throw new TokenError(msg)
    // HANYA kode rate-limit Meta yang asli (BUKAN range 17–613 — itu nelan 100/148/200 dst).
    const RATE_LIMIT_CODES = [4, 17, 32, 341, 613, 80000, 80001, 80002, 80003, 80004, 80014, 130429]
    if (RATE_LIMIT_CODES.includes(code)) throw new RateLimitError(msg)
    // Selain itu: lempar pesan ASLI (jangan di-masking jadi RateLimit) — mis. 100 Invalid parameter.
    throw new Error(`Meta API error (code ${code}): ${msg}`)
  }

  return { data, headers: res.headers }
}

async function withRetry<T>(
  fn: () => Promise<T>,
  attempt = 1,
  maxAttempts = 3,
): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (attempt >= maxAttempts || (!(err instanceof RateLimitError) && !(err instanceof TokenError))) throw err
    if (err instanceof TokenError) throw err
    const backoff = getBackoffMs(attempt, lastUsagePct)
    console.warn(`[meta-client] retry ${attempt}/${maxAttempts} backing off ${backoff}ms`)
    await new Promise(r => setTimeout(r, backoff))
    return withRetry(fn, attempt + 1, maxAttempts)
  }
}

export async function metaGet(path: string, token: string, params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return withRetry(() => request('GET', `${path}${qs}`, token))
}

export async function metaPost(path: string, token: string, body: Record<string, string>) {
  return withRetry(() => request('POST', path, token, body))
}

// ── Helper: getCampaignStructure ──────────────────────────

interface CampaignNode { id: string; name: string; status: string; [key: string]: unknown }

export async function getCampaignStructure(
  adAccountId: string,
  campaignId: string,
  token: string,
): Promise<{ campaign: CampaignNode; adsets: CampaignNode[]; ads: CampaignNode[] }> {
  const fields = `id,name,status,effective_status,daily_budget,lifetime_budget,budget_remaining,adsets{id,name,status,effective_status,daily_budget,lifetime_budget,targeting{targeted_relaxation},ads{id,name,status,effective_status,creative{id,asset_feed_spec,object_story_spec}}}`
  const { data } = await metaGet(`/${campaignId}`, token, { fields })
  const campaign = data as CampaignNode
  const adsets: CampaignNode[] = []
  const ads: CampaignNode[] = []
  let adsetData = (campaign as any).adsets?.data ?? []
  let adsetPaging = (campaign as any).adsets?.paging
  while (adsetData?.length > 0) {
    for (const as of adsetData) {
      adsets.push(as)
      let adItems = as.ads?.data ?? []
      let adPaging = as.ads?.paging
      while (adItems?.length > 0) {
        for (const ad of adItems) ads.push(ad)
        if (adPaging?.next) { const { data: nd } = await metaGet(adPaging.next, token); adItems = (nd as any).data ?? []; adPaging = (nd as any).paging }
        else break
      }
    }
    if (adsetPaging?.next) { const { data: nd } = await metaGet(adsetPaging.next, token); adsetData = (nd as any).data ?? []; adsetPaging = (nd as any).paging }
    else break
  }
  return { campaign, adsets, ads }
}

// ── Helper: getInsights ───────────────────────────────────

export interface InsightResult {
  spend: number; impressions: number; clicks: number
  cpc: number | null; ctr: number | null
  purchases: number; purchaseValue: number; purchaseRoas: number | null
  frequency: number | null
}

export async function getInsights(
  entityId: string, token: string, datePreset: string = 'maximum',
): Promise<InsightResult> {
  const fields = 'spend,impressions,clicks,cpc,ctr,frequency,actions{purchase_roas},action_values{purchase_roas}'
  const { data } = await metaGet(`/${entityId}/insights`, token, { fields, date_preset: datePreset, level: 'ad', limit: '50' })
  const rows = (data as any)?.data ?? []
  let spend = 0, impressions = 0, clicks = 0, purchases = 0, purchaseValue = 0, frequency = 0
  const roasValues: number[] = []
  for (const row of rows) {
    spend += Number(row.spend ?? 0); impressions += Number(row.impressions ?? 0); clicks += Number(row.clicks ?? 0)
    if (row.frequency != null) frequency = Math.max(frequency, Number(row.frequency))
    for (const a of (row.actions ?? [])) { if (a.action_type === 'purchase_roas' && a.value) roasValues.push(Number(a.value)) }
    for (const av of (row.action_values ?? [])) { if (av.action_type === 'purchase' && av.value) purchaseValue += Number(av.value) }
    for (const sa of (row.actions ?? [])) { if (sa.action_type === 'purchase' && sa.value) purchases += Math.round(Number(sa.value)) }
  }
  const cpc = clicks > 0 ? spend / clicks : null
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : null
  const purchaseRoas = roasValues.length > 0 ? roasValues.reduce((a, b) => a + b, 0) / roasValues.length : null
  return { spend, impressions, clicks, cpc, ctr, purchases, purchaseValue, purchaseRoas, frequency: frequency > 0 ? frequency : null } as InsightResult
}

// ── Helper: updateBudget ──────────────────────────────────
// level: 'CAMPAIGN' → /{campaignId} (CBO), 'ADSET' → /{adsetId} (ABO)

export async function updateBudget(
  entityId: string,
  dailyBudgetMinor: number,
  token: string,
  level: 'CAMPAIGN' | 'ADSET' = 'CAMPAIGN',
): Promise<void> {
  const field = level === 'ADSET' ? 'daily_budget' : 'daily_budget'
  await metaPost(`/${entityId}`, token, { [field]: String(dailyBudgetMinor) })
}

// ── Helper: setStatus ─────────────────────────────────────

export async function setStatus(entityId: string, status: 'ACTIVE' | 'PAUSED', token: string): Promise<void> {
  await metaPost(`/${entityId}`, token, { status })
}

// ── Helper: uploadImageToMeta ─────────────────────────────
// Upload image from URL → Meta adimage hash.
// IMPORTANT: File upload (multipart) works, URL-based upload returns #3 for this app.
// Strategy: download → file upload

export async function uploadImageToMeta(
  adAccountId: string, imageUrl: string, token: string,
): Promise<{ hash: string; id: string }> {
  // 1. Download image
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) throw new Error(`Failed to download image: HTTP ${imgRes.status}`)
  const imgBuffer = await imgRes.arrayBuffer()

  // 2. Upload via multipart file upload (CPAS uses this approach — works ✅)
  const formData = new FormData()
  formData.append('access_token', token)
  formData.append('published', 'false')
  formData.append('file', new Blob([imgBuffer], { type: 'image/jpeg' }), 'ad_image.jpg')

  const uploadRes = await fetch(`https://graph.facebook.com/v25.0/act_${adAccountId}/adimages`, {
    method: 'POST',
    body: formData,
  })
  const data = await uploadRes.json() as any

  if (!uploadRes.ok || !data?.images) {
    throw new Error(data?.error?.message ?? `HTTP ${uploadRes.status}: Meta upload failed`)
  }

  const images = data.images as Record<string, { hash: string; id: string }>
  const firstKey = Object.keys(images)[0]
  if (!firstKey) throw new Error('Meta upload returned no images')
  return { hash: images[firstKey].hash, id: images[firstKey].id }
}

// ── Helper: resolvePageId ─────────────────────────────────
// Fetch the connected Facebook Page for an ad account.
// Priority: 1) TestLaunchAdset.identityPageId (via sessionId → testLaunch.campaignSessions)
//           2) MetaPage linked to MetaAdAccount (DB)
//           3) /me/accounts (Meta API fallback)

export async function resolvePageId(
  adAccountId: string,
  token: string,
  context?: { sessionId?: string; metaAdAccountId?: string },
): Promise<string> {
  // Priority 1: TestLaunchAdset.identityPageId
  if (context?.sessionId) {
    try {
      const { prisma } = await import('@/lib/prisma')
      const session = await prisma.campaignSession.findUnique({
        where: { id: context.sessionId },
        select: {
          testLaunch: {
            select: {
              adsets: {
                select: { identityPageId: true },
                take: 1,
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
        },
      })
      const tid = session?.testLaunch?.adsets?.[0]?.identityPageId
      if (tid) return tid
    } catch { /* fall through */ }
  }

  // Priority 2: MetaPage linked to MetaAdAccount
  if (context?.metaAdAccountId) {
    try {
      const { prisma } = await import('@/lib/prisma')
      const page = await prisma.metaPage.findFirst({
        where: { metaAccountId: context.metaAdAccountId, isActive: true },
        select: { pageId: true },
      })
      if (page?.pageId) return page.pageId
    } catch { /* fall through */ }
  }

  // Priority 3: Meta API fallback — get user's pages
  const { data: pages } = await metaGet('/me/accounts', token, { fields: 'id,name', limit: '1' })
  const pageList = (pages as any)?.data ?? []
  if (pageList.length === 0) throw new Error('No Facebook Page found for this token')
  return pageList[0].id
}

export interface AdCreativeSpec {
  adAccountId: string       // numeric or act_xxx — WAJIB, jangan dari parse adsetId
  pageId: string            // Facebook Page ID untuk object_story_spec — WAJIB
  name: string
  adsetId: string
  primaryText: string
  headline: string
  description?: string
  callToAction: string
  linkUrl: string
  mediaUrl?: string | null  // URL gambar eksternal → upload ke Meta dulu
  creativeUrl?: string | null
  status?: 'ACTIVE' | 'PAUSED'
  publisherPlatforms?: ('facebook' | 'instagram' | 'messenger' | 'audience_network')[]
}

export async function createAd(
  spec: AdCreativeSpec,
  token: string,
): Promise<{ adId: string; creativeId: string }> {
  const publisherPlatforms = spec.publisherPlatforms ?? ['facebook', 'instagram']
  const hasMedia = spec.mediaUrl != null && spec.mediaUrl.length > 0

  // 1. Upload media to Meta if URL provided → get hash
  let attachmentHash: string | undefined
  if (hasMedia) {
    const uploaded = await uploadImageToMeta(spec.adAccountId, spec.mediaUrl!, token)
    attachmentHash = uploaded.hash
  }

  // 2. Build creative payload
  const linkData: Record<string, any> = {
    link: spec.linkUrl,
    message: spec.primaryText,
    name: spec.headline,
    call_to_action: { type: spec.callToAction },
  }
  if (spec.description) linkData.description = spec.description
  // Note: image_hash is set at top level (below), NOT inside link_data

  const creativePayload: Record<string, string> = {
    name: `AD: ${spec.name}`,
    object_story_spec: JSON.stringify({
      page_id: spec.pageId,
      link_data: linkData,
    }),
    publisher_platforms: publisherPlatforms.join(','),
    // degrees_of_freedom_spec/standard_enhancements DIHAPUS — Meta v25 nolak
    // ("Creative should not include standard enhancements", subcode 3858504).
  }
  // image_hash at top level (file-uploaded images require this, not attachment_hash in link_data)
  if (attachmentHash) {
    creativePayload.image_hash = attachmentHash
  }

  const { data: creative } = await metaPost(`/act_${spec.adAccountId}/adcreatives`, token, creativePayload)
  const creativeData = creative as { id: string }

  // 3. Create ad (PAUSED by default)
  const status = spec.status ?? 'PAUSED'
  const { data: ad } = await metaPost(`/act_${spec.adAccountId}/ads`, token, {
    name: spec.name,
    adset_id: spec.adsetId,
    creative: JSON.stringify({ creative_id: creativeData.id }),
    status,
  })
  const adData = ad as { id: string }

  return { adId: adData.id, creativeId: creativeData.id }
}

// ── Helper: createCampaign ────────────────────────────────
// POST /act_{adAccountId}/campaigns
export async function createCampaign(
  adAccountId: string,
  spec: {
    name: string
    objective: string
    status?: 'PAUSED' | 'ACTIVE'
    specialAdCategories?: string[]
  },
  token: string,
): Promise<{ id: string }> {
  const body: Record<string, string> = {
    name: spec.name,
    objective: spec.objective,
    status: spec.status ?? 'PAUSED',
    special_ad_categories: JSON.stringify(spec.specialAdCategories ?? []),
  }
  const { data } = await metaPost(`act_${adAccountId}/campaigns`, token, body)
  const campaign = data as { id: string }
  return { id: campaign.id }
}

// ── Helper: createAdset ───────────────────────────────────
// POST /act_{adAccountId}/adsets
export async function createAdset(
  adAccountId: string,
  spec: {
    name: string
    campaignId: string
    dailyBudgetMinor?: number
    optimizationGoal: string
    billingEvent: string
    bidStrategy?: string
    targetingJson: string
    status?: 'PAUSED' | 'ACTIVE'
    startTime?: string
  },
  token: string,
): Promise<{ id: string }> {
  const body: Record<string, string> = {
    name: spec.name,
    campaign_id: spec.campaignId,
    optimization_goal: spec.optimizationGoal,
    billing_event: spec.billingEvent,
    targeting: spec.targetingJson,
    status: spec.status ?? 'PAUSED',
  }
  if (spec.dailyBudgetMinor !== undefined) body.daily_budget = String(spec.dailyBudgetMinor)
  if (spec.bidStrategy) body.bid_strategy = spec.bidStrategy
  if (spec.startTime) body.start_time = spec.startTime

  const { data } = await metaPost(`act_${adAccountId}/adsets`, token, body)
  const adset = data as { id: string }
  return { id: adset.id }
}
