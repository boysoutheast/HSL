export interface Counters {
  spend: number
  impressions: number
  clicks: number
  linkClicks: number
  leads: number
  purchases: number
  revenue: number
  landingPageViews: number
}

export interface DerivedMetrics {
  ctr: number | null
  cpc: number | null
  cpl: number | null
  cplc: number | null
  cpm: number | null
  roas: number | null
  convRate: number | null
  costPerLpv: number | null
  cpa: number | null
}

export function deriveMetrics(counters: Counters): DerivedMetrics {
  const {
    spend, impressions, clicks, linkClicks,
    leads, purchases, revenue, landingPageViews,
  } = counters

  return {
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    cpc: clicks > 0 ? spend / clicks : null,
    cpl: leads > 0 ? spend / leads : null,
    cplc: linkClicks > 0 ? spend / linkClicks : null,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
    roas: spend > 0 ? revenue / spend : null,
    convRate: clicks > 0 ? (purchases / clicks) * 100 : null,
    costPerLpv: landingPageViews > 0 ? spend / landingPageViews : null,
    cpa: purchases > 0 ? spend / purchases : null,
  }
}

export type SuccessMetric =
  | 'ROAS' | 'CPM' | 'CPLC' | 'CPL' | 'CPC' | 'CTR'
  | 'COST_PER_LPV' | 'CVR' | 'CPA'

// Higher-is-better (HIB) vs Lower-is-better (LIB)
const HIB_METRICS: Set<SuccessMetric> = new Set(['ROAS', 'CTR', 'CVR'])
function isHIB(m: SuccessMetric): boolean {
  return HIB_METRICS.has(m)
}

export function getMetricValue(variant: {
  spend: number
  impressions: number
  clicks: number
  linkClicks: number
  leads: number
  purchases: number
  revenue: number
  landingPageViews: number
  ctr: number | null
  cpc: number | null
  cpl: number | null
  cplc: number | null
  cpm: number | null
  roas: number | null
  convRate: number | null
  costPerLpv: number | null
}, metric: SuccessMetric): number | null {
  switch (metric) {
    case 'ROAS': return variant.roas
    case 'CPM': return variant.cpm
    case 'CPLC': return variant.cplc
    case 'CPL': return variant.cpl
    case 'CPC': return variant.cpc
    case 'CTR': return variant.ctr
    case 'COST_PER_LPV': return variant.costPerLpv
    case 'CVR': return variant.convRate
    case 'CPA': return variant.spend > 0 && variant.purchases > 0
      ? variant.spend / variant.purchases
      : null
    default: return null
  }
}

export interface RankedVariant extends Record<string, unknown> {
  id: string
  label: string
  name: string
  metricValue: number | null
  isLeader: boolean
}

export function rankVariants(
  variants: Array<{
    id: string
    label: string
    name: string
    spend: number
    impressions: number
    clicks: number
    linkClicks: number
    leads: number
    purchases: number
    revenue: number
    landingPageViews: number
    ctr: number | null
    cpc: number | null
    cpl: number | null
    cplc: number | null
    cpm: number | null
    roas: number | null
    convRate: number | null
    costPerLpv: number | null
  }>,
  successMetric: SuccessMetric,
): RankedVariant[] {
  const withValue: RankedVariant[] = variants.map((v) => ({
    id: v.id,
    label: v.label,
    name: v.name,
    metricValue: getMetricValue(v, successMetric),
    isLeader: false,
  }))

  const sorted = [...withValue].sort((a, b) => {
    const aV = a.metricValue
    const bV = b.metricValue
    if (aV === null && bV === null) return 0
    if (aV === null) return 1
    if (bV === null) return -1
    return isHIB(successMetric) ? bV - aV : aV - bV
  })

  if (sorted.length > 0 && sorted[0].metricValue !== null) {
    sorted[0].isLeader = true
  }

  return sorted
}

export function getDisplayMetrics(successMetric: SuccessMetric) {
  const displayMap: Record<SuccessMetric, string[]> = {
    ROAS: ['ROAS', 'purchases', 'spend'],
    CPM: ['CPM', 'impressions', 'spend'],
    CPLC: ['CPLC', 'linkClicks', 'spend'],
    CPL: ['CPL', 'leads', 'spend'],
    CPC: ['CPC', 'clicks', 'spend'],
    CTR: ['CTR', 'clicks', 'impressions'],
    COST_PER_LPV: ['costPerLpv', 'landingPageViews', 'spend'],
    CVR: ['CVR', 'purchases', 'clicks'],
    CPA: ['CPA', 'purchases', 'spend'],
  }
  return displayMap[successMetric] ?? ['spend', 'impressions']
}
