'use client'

import { useEffect, useState, useCallback } from 'react'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

/* ─── Types ─── */
interface Variant {
  id: string
  label: string
  name: string
  generatedMediaId: string | null
  testLaunchCreativeId: string | null
  creativeVariantId: string | null
  cepId: string | null
  landingPageId: string | null
  offerVariantId: string | null
  metaAdId: string | null
  spend: number
  impressions: number
  clicks: number
  linkClicks: number
  landingPageViews: number
  leads: number
  purchases: number
  revenue: number
  ctr: number | null
  cpc: number | null
  cpl: number | null
  cplc: number | null
  cpm: number | null
  roas: number | null
  convRate: number | null
  costPerLpv: number | null
  status: string
  lastSyncedAt: string | null
  createdAt: string
}

interface AdTest {
  id: string
  userId: string
  productId: string | null
  campaignSessionId: string | null
  testLaunchId: string | null
  name: string
  type: string
  objective: string
  successMetric: string
  hypothesis: string | null
  status: string
  winnerVariantId: string | null
  minSpendPerVariant: string | null
  track: string
  autoScaleWinner: boolean
  startedAt: string | null
  endedAt: string | null
  notes: string | null
  createdAt: string
  variants: Variant[]
  product?: { id: string; name: string } | null
  campaignSession?: { id: string; name: string } | null
}

/* ─── Metric helpers ─── */
type SuccessMetric =
  | 'ROAS' | 'CPM' | 'CPLC' | 'CPL' | 'CPC' | 'CTR'
  | 'COST_PER_LPV' | 'CVR' | 'CPA'

const ALL_METRICS: SuccessMetric[] = [
  'ROAS', 'CPM', 'CPLC', 'CPL', 'CPC', 'CTR',
  'COST_PER_LPV', 'CVR', 'CPA',
]

function fmtNum(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined) return '—'
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'jt'
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'rb'
  return n.toFixed(decimals)
}

function fmtCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return 'Rp' + Math.round(n).toLocaleString('id-ID')
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return n.toFixed(2) + '%'
}

function getMetricValue(v: Variant, metric: SuccessMetric): number | null {
  switch (metric) {
    case 'ROAS': return v.roas
    case 'CPM': return v.cpm
    case 'CPLC': return v.cplc
    case 'CPL': return v.cpl
    case 'CPC': return v.cpc
    case 'CTR': return v.ctr
    case 'COST_PER_LPV': return v.costPerLpv
    case 'CVR': return v.convRate
    case 'CPA': return v.spend > 0 && v.purchases > 0 ? v.spend / v.purchases : null
    default: return null
  }
}

function fmtMetric(v: Variant, metric: SuccessMetric): string {
  const val = getMetricValue(v, metric)
  if (val === null) return '—'
  if (metric === 'ROAS') return val.toFixed(2) + 'x'
  if (metric === 'CTR' || metric === 'CVR') return fmtPct(val)
  if (['CPC', 'CPL', 'CPLC', 'CPM', 'CPA', 'COST_PER_LPV'].includes(metric)) return fmtCurrency(val)
  return fmtNum(val)
}

const HIB: Set<string> = new Set(['ROAS', 'CTR', 'CVR'])

/* ─── Display metrics per success metric ─── */
function getDisplayMetrics(sm: SuccessMetric): string[] {
  const map: Record<SuccessMetric, string[]> = {
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
  return map[sm] ?? ['spend', 'impressions']
}

function variantMetricDisplay(v: Variant, field: string): string {
  switch (field) {
    case 'ROAS': return v.roas !== null ? v.roas.toFixed(2) + 'x' : '—'
    case 'CPM': return fmtCurrency(v.cpm)
    case 'CPLC': return fmtCurrency(v.cplc)
    case 'CPL': return fmtCurrency(v.cpl)
    case 'CPC': return fmtCurrency(v.cpc)
    case 'CTR': return fmtPct(v.ctr)
    case 'COST_PER_LPV': return fmtCurrency(v.costPerLpv)
    case 'CVR': return fmtPct(v.convRate)
    case 'CPA': return fmtCurrency(v.spend > 0 && v.purchases > 0 ? v.spend / v.purchases : null)
    case 'spend': return fmtCurrency(v.spend)
    case 'impressions': return fmtNum(v.impressions, 0)
    case 'clicks': return fmtNum(v.clicks, 0)
    case 'linkClicks': return fmtNum(v.linkClicks, 0)
    case 'leads': return fmtNum(v.leads, 0)
    case 'purchases': return fmtNum(v.purchases, 0)
    case 'landingPageViews': return fmtNum(v.landingPageViews, 0)
    default: return '—'
  }
}

function metricLabel(field: string): string {
  const map: Record<string, string> = {
    ROAS: 'ROAS', CPM: 'CPM', CPLC: 'CPLC', CPL: 'CPL', CPC: 'CPC',
    CTR: 'CTR', COST_PER_LPV: 'Cost/LPV', CVR: 'CVR', CPA: 'CPA',
    spend: 'Spend', impressions: 'Impr.', clicks: 'Clicks',
    linkClicks: 'Link Clicks', leads: 'Leads', purchases: 'Purch.',
    landingPageViews: 'LPV',
  }
  return map[field] ?? field
}

const TYPE_BADGE: Record<string, string> = {
  CREATIVE: 'bg-blue-100 text-blue-700',
  CEP: 'bg-emerald-100 text-emerald-700',
  LP: 'bg-amber-100 text-amber-700',
  PRICE: 'bg-purple-100 text-purple-700',
  COMBINED: 'bg-rose-100 text-rose-700',
}
const OBJ_BADGE: Record<string, string> = {
  PURCHASE: 'bg-violet-100 text-violet-700',
  LEADS: 'bg-cyan-100 text-cyan-700',
  ATC: 'bg-orange-100 text-orange-700',
}
const STATUS_BADGE: Record<string, string> = {
  RUNNING: 'bg-green-100 text-green-700',
  PAUSED: 'bg-yellow-100 text-yellow-700',
  WINNER_DECLARED: 'bg-blue-100 text-blue-700',
  ARCHIVED: 'bg-stone-100 text-stone-500',
}

/* ─── Main component ─── */
export default function TestingPage() {
  const [tests, setTests] = useState<AdTest[]>([])
  const [loading, setLoading] = useState(true)
  const [showDrawer, setShowDrawer] = useState(false)
  const [showWinner, setShowWinner] = useState<AdTest | null>(null)
  const [collapsedCompleted, setCollapsedCompleted] = useState(true)
  const [archiveTarget, setArchiveTarget] = useState<AdTest | null>(null)
  const [actionLoading, setActionLoading] = useState<Map<string, string>>(new Map())
  const [actionError, setActionError] = useState<string | null>(null)

  const setAction = (testId: string, action: string) =>
    setActionLoading(prev => { const m = new Map(prev); m.set(testId, action); return m })
  const clearAction = (testId: string) =>
    setActionLoading(prev => { const m = new Map(prev); m.delete(testId); return m })

  const loadTests = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ad-tests', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setTests(data.tests ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTests() }, [loadTests])

  const syncMetrics = async (testId: string) => {
    setActionError(null)
    setAction(testId, 'sync')
    try {
      const res = await fetch(`/api/admin/ad-tests/${testId}/sync-metrics`, {
        method: 'POST', credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setActionError(`Sync gagal: ${data.error ?? res.status}`)
      } else {
        await loadTests()
      }
    } catch { setActionError('Sync gagal — koneksi error') } finally {
      clearAction(testId)
    }
  }

  const declareWinner = async (testId: string, variantId: string) => {
    setActionError(null)
    setAction(testId, 'declare')
    try {
      const res = await fetch(`/api/admin/ad-tests/${testId}/declare-winner`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setActionError(`Declare gagal: ${data.error ?? res.status}`)
      } else {
        setShowWinner(null)
        await loadTests()
      }
    } catch { setActionError('Declare gagal — koneksi error') } finally {
      clearAction(testId)
    }
  }

  const archiveTest = async () => {
    if (!archiveTarget) return
    setActionError(null)
    setAction(archiveTarget.id, 'archive')
    try {
      const res = await fetch(`/api/admin/ad-tests/${archiveTarget.id}`, {
        method: 'DELETE', credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setActionError(`Arsip gagal: ${data.error ?? res.status}`)
      } else {
        await loadTests()
        setArchiveTarget(null)
      }
    } catch { setActionError('Arsip gagal — koneksi error') } finally {
      clearAction(archiveTarget.id)
    }
  }

  const updateSuccessMetric = async (testId: string, successMetric: string) => {
    try {
      await fetch(`/api/admin/ad-tests/${testId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ successMetric }),
      })
      await loadTests()
    } catch { /* silent */ }
  }

  const running = tests.filter(t => t.status === 'RUNNING' || t.status === 'PAUSED')
  const completed = tests.filter(t => t.status === 'WINNER_DECLARED' || t.status === 'ARCHIVED')

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-sm text-stone-400">Memuat...</div>
  }

  if (tests.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-stone-800">Testing Lab</h2>
          <button onClick={() => setShowDrawer(true)}
            className="px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">
            + Test Baru
          </button>
        </div>
        <EmptyState
          title="Belum ada test"
          description="Buat test pertama untuk mulai membandingkan performa creative, CEP, landing page, atau harga."
          action={{ label: 'Buat Test', onClick: () => setShowDrawer(true) }}
        />
        {showDrawer && <NewTestDrawer onClose={() => setShowDrawer(false)} onCreated={loadTests} />}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-stone-800">Testing Lab</h2>
        <button onClick={() => setShowDrawer(true)}
          className="px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">
          + Test Baru
        </button>
      </div>

      {/* Running */}
      <div className="space-y-4">
        {running.map(test => <TestCard key={test.id} test={test}
          onSync={() => syncMetrics(test.id)}
          onDeclare={() => setShowWinner(test)}
          onArchive={() => setArchiveTarget(test)}
          onMetricChange={(m) => updateSuccessMetric(test.id, m)}
          actionLoading={actionLoading}
        />)}
      </div>

      {/* Completed */}
      {completed.length > 0 && (
        <div className="mt-8">
          <button onClick={() => setCollapsedCompleted(v => !v)}
            className="flex items-center gap-2 text-xs font-semibold text-stone-500 hover:text-stone-700 mb-3">
            <svg className={`w-3 h-3 transition-transform ${collapsedCompleted ? '' : 'rotate-90'}`}
              fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            Selesai ({completed.length})
          </button>
          {!collapsedCompleted && (
            <div className="space-y-3 opacity-60">
              {completed.map(test => <TestCard key={test.id} test={test}
                onSync={() => syncMetrics(test.id)}
                onDeclare={() => {}}
                onArchive={() => setArchiveTarget(test)}
                onMetricChange={(m) => updateSuccessMetric(test.id, m)}
                actionLoading={actionLoading}
              />)}
            </div>
          )}
        </div>
      )}

      {/* Drawers */}
      {showDrawer && <NewTestDrawer onClose={() => setShowDrawer(false)} onCreated={loadTests} />}
      {showWinner && <WinnerModal test={showWinner} onClose={() => setShowWinner(null)} onConfirm={declareWinner} />}
      <ConfirmDialog
        open={archiveTarget !== null}
        title="Arsipkan Test"
        body={<p>Arsipkan test <strong>{archiveTarget?.name}</strong>? Test bisa dilihat lagi di bagian Selesai, tapi tidak aktif.</p>}
        confirmLabel="Arsipkan"
        danger
        loading={archiveTarget ? (actionLoading.get(archiveTarget.id) === 'archive') : false}
        onConfirm={archiveTest}
        onCancel={() => setArchiveTarget(null)}
      />
      {/* Error banner */}
      {actionError && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 shadow-lg">
          <div className="flex items-start gap-2">
            <span className="flex-1">{actionError}</span>
            <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Test Card ─── */
function TestCard({ test, onSync, onDeclare, onArchive, onMetricChange, actionLoading }: {
  test: AdTest
  onSync: () => void
  onDeclare: () => void
  onArchive: () => void
  onMetricChange: (m: string) => void
  actionLoading?: Map<string, string>
}) {
  const sm = (ALL_METRICS.includes(test.successMetric as SuccessMetric) ? test.successMetric : 'ROAS') as SuccessMetric
  const displayFields = getDisplayMetrics(sm)
  const isWinnerDeclared = test.status === 'WINNER_DECLARED'

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-50">
        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${TYPE_BADGE[test.type] ?? 'bg-stone-100 text-stone-600'}`}>
          {test.type}
        </span>
        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${OBJ_BADGE[test.objective] ?? 'bg-stone-100 text-stone-600'}`}>
          {test.objective}
        </span>
        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${STATUS_BADGE[test.status] ?? ''}`}>
          {test.status}
        </span>
        <span className="text-sm font-semibold text-stone-800 flex-1">{test.name}</span>
        {/* Success metric dropdown */}
        <select
          value={test.successMetric}
          onChange={e => onMetricChange(e.target.value)}
          className="text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white text-stone-600"
        >
          {ALL_METRICS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Variant compare */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-stone-100">
        {test.variants.map(v => {
          const metricVal = getMetricValue(v, sm)
          // Find leader
          const values = test.variants.map(x => getMetricValue(x, sm)).filter(x => x !== null && x > 0) as number[]
          const best = values.length > 0
            ? (HIB.has(sm) ? Math.max(...values) : Math.min(...values))
            : null
          const isLeader = metricVal !== null && best !== null && metricVal === best && values.length > 0
          // Progress bar: HIB — pct = val / max, LIB — pct = min / val. Clamp [3, 100].
          // Hasil: pemenang selalu bar terpanjang (~100%), apapun metriknya.
          let pct = 0
          if (values.length > 0 && metricVal !== null && metricVal > 0) {
            pct = HIB.has(sm)
              ? (metricVal / Math.max(...values)) * 100
              : (Math.min(...values) / metricVal) * 100
            pct = Math.max(3, Math.min(100, pct))
          }

          return (
            <div key={v.id} className={`p-4 ${v.status === 'winner' ? 'bg-green-50/50' : v.status === 'killed' ? 'bg-red-50/30' : ''}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold
                  ${v.status === 'winner' ? 'bg-green-500 text-white' : v.status === 'killed' ? 'bg-red-300 text-white' : 'bg-stone-200 text-stone-600'}`}>
                  {v.label}
                </span>
                <span className="text-xs font-medium text-stone-700 truncate">{v.name}</span>
                {v.status === 'winner' && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">WINNER</span>}
                {v.status === 'killed' && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-500">KILLED</span>}
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-stone-100 rounded-full mb-3 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${isLeader && v.status !== 'killed' ? 'bg-violet-500' : 'bg-stone-300'}`}
                  style={{ width: `${Math.max(3, pct)}%` }} />
              </div>

              {/* Metrics */}
              <div className="space-y-1">
                {displayFields.map(f => (
                  <div key={f} className="flex items-center justify-between">
                    <span className="text-[10px] text-stone-400 uppercase">{metricLabel(f)}</span>
                    <span className={`text-xs font-semibold ${f === sm ? 'text-violet-700' : 'text-stone-600'}`}>
                      {variantMetricDisplay(v, f)}
                    </span>
                  </div>
                ))}
                {displayFields.length < 3 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-stone-400 uppercase">{metricLabel('CPA')}</span>
                    <span className="text-xs font-semibold text-stone-600">{variantMetricDisplay(v, 'CPA')}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-stone-50 bg-stone-50/50">
        <button onClick={onSync} disabled={actionLoading?.get(test.id) === 'sync'}
          className="px-2.5 py-1 text-[11px] font-medium text-violet-600 hover:bg-violet-50 rounded-lg transition-colors disabled:opacity-50">
          {actionLoading?.get(test.id) === 'sync' ? 'Syncing…' : 'Sync Metrics'}
        </button>
        {!isWinnerDeclared && (
          <button onClick={onDeclare} disabled={actionLoading?.get(test.id) === 'declare'}
            className="px-2.5 py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50">
            {actionLoading?.get(test.id) === 'declare' ? 'Declaring…' : 'Declare Winner'}
          </button>
        )}
        <button onClick={onArchive} disabled={actionLoading?.get(test.id) === 'archive'}
          className="px-2.5 py-1 text-[11px] font-medium text-stone-500 hover:bg-stone-100 rounded-lg transition-colors ml-auto disabled:opacity-50">
          {actionLoading?.get(test.id) === 'archive' ? 'Archiving…' : 'Archive'}
        </button>
      </div>
    </div>
  )
}

/* ─── New Test Drawer ─── */
function NewTestDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    name: '',
    type: 'CREATIVE',
    objective: 'PURCHASE',
    successMetric: 'ROAS',
    hypothesis: '',
    productId: '',
    campaignSessionId: '',
    autoScaleWinner: false,
  })
  const [variants, setVariants] = useState<Array<{
    label: string; name: string; generatedMediaId?: string; cepId?: string
    landingPageId?: string; offerVariantId?: string; metaAdId?: string
  }>>([
    { label: 'A', name: '' },
    { label: 'B', name: '' },
  ])
  const [submitting, setSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // ─── Pickers: load real options instead of pasting raw IDs ───
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([])
  const [options, setOptions] = useState<Array<{ id: string; label: string }>>([])
  const [loadingOpts, setLoadingOpts] = useState(false)

  // ─── Campaign picker state ───
  const [sessions, setSessions] = useState<Array<{ id: string; name: string }>>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [campaignAds, setCampaignAds] = useState<Array<{ metaEntityId: string; name: string; status?: string }>>([])
  const [showAdPicker, setShowAdPicker] = useState<Map<number, boolean>>(new Map())

  useEffect(() => {
    setLoadingSessions(true)
    fetch('/api/admin/campaign-sessions', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : { sessions: [] }))
      .then(d => setSessions(d.sessions ?? []))
      .catch(() => {})
      .finally(() => setLoadingSessions(false))
  }, [])

  // ─── Fetch campaign ads when campaign selected ───
  useEffect(() => {
    if (!form.campaignSessionId) { setCampaignAds([]); return }
    fetch(`/api/admin/campaign-sessions/${form.campaignSessionId}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : { session: null }))
      .then(d => {
        const metaEntities = d.session?.metaEntities ?? []
        const ads = metaEntities
          .filter((e: { entityType: string }) => e.entityType === 'AD')
          .map((e: { metaEntityId: string; name: string; effectiveStatus?: string }) => ({
            metaEntityId: e.metaEntityId,
            name: e.name,
            status: e.effectiveStatus,
          }))
        setCampaignAds(ads)
      })
      .catch(() => setCampaignAds([]))
  }, [form.campaignSessionId])

  useEffect(() => {
    fetch('/api/admin/products', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : { products: [] }))
      .then(d => setProducts(d.products ?? []))
      .catch(() => {})
  }, [])

  const isCreative = form.type === 'CREATIVE' || form.type === 'COMBINED'
  const needsProduct = !isCreative // CEP/LP/PRICE difilter per produk

  useEffect(() => {
    type Src = { id: string; prompt?: string; cepText?: string; label?: string; url?: string; variant?: string; price?: number | string }
    let url: string | null = null
    if (isCreative) url = '/api/gen/media?limit=100'
    else if (form.type === 'CEP') url = form.productId ? `/api/admin/ceps?productId=${form.productId}` : null
    else if (form.type === 'LP') url = form.productId ? `/api/admin/products/${form.productId}/landing-pages` : null
    else if (form.type === 'PRICE') url = form.productId ? `/api/admin/products/${form.productId}/offer-variants` : null
    if (!url) { setOptions([]); return }
    setLoadingOpts(true)
    fetch(url, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : {}))
      .then((d: { media?: Src[]; ceps?: Src[]; landingPages?: Src[]; offers?: Src[] }) => {
        let opts: Array<{ id: string; label: string }> = []
        if (isCreative) opts = ((d.media ?? []) as Src[]).map(m => ({ id: m.id, label: m.prompt ? String(m.prompt).slice(0, 60) : m.id }))
        else if (form.type === 'CEP') opts = ((d.ceps ?? []) as Src[]).map(c => ({ id: c.id, label: c.cepText ? String(c.cepText).slice(0, 60) : c.id }))
        else if (form.type === 'LP') opts = ((d.landingPages ?? []) as Src[]).map(l => ({ id: l.id, label: `${l.variant ?? ''} ${l.label ?? l.url ?? ''}`.trim() || l.id }))
        else if (form.type === 'PRICE') opts = ((d.offers ?? []) as Src[]).map(o => ({ id: o.id, label: `${o.label ?? ''}${o.price != null ? ` · Rp${Number(o.price).toLocaleString('id-ID')}` : ''}`.trim() || o.id }))
        setOptions(opts)
      })
      .catch(() => setOptions([]))
      .finally(() => setLoadingOpts(false))
  }, [form.type, form.productId, isCreative])

  const refValue = (v: typeof variants[number]): string =>
    form.type === 'CEP' ? (v.cepId ?? '')
      : form.type === 'LP' ? (v.landingPageId ?? '')
      : form.type === 'PRICE' ? (v.offerVariantId ?? '')
      : (v.generatedMediaId ?? '')

  const setRefValue = (idx: number, id: string) => {
    const val = id || undefined
    const next = [...variants]
    if (form.type === 'CEP') next[idx] = { ...next[idx], cepId: val }
    else if (form.type === 'LP') next[idx] = { ...next[idx], landingPageId: val }
    else if (form.type === 'PRICE') next[idx] = { ...next[idx], offerVariantId: val }
    else next[idx] = { ...next[idx], generatedMediaId: val }
    setVariants(next)
  }

  const refLabel = form.type === 'CEP' ? 'CEP' : form.type === 'LP' ? 'Landing Page' : form.type === 'PRICE' ? 'Harga/Offer' : 'Creative (dari Studio)'

  const addVariant = () => {
    const next = String.fromCharCode(65 + variants.length) // C, D, etc.
    if (variants.length >= 4) return
    setVariants([...variants, { label: next, name: '' }])
  }

  const removeVariant = (idx: number) => {
    if (variants.length <= 2) return
    setVariants(variants.filter((_, i) => i !== idx))
  }

  const createTest = async () => {
    if (!form.name || variants.some(v => !v.name)) return
    setSubmitting(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/admin/ad-tests', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({...form,
          productId: form.productId || undefined,
          campaignSessionId: form.campaignSessionId || undefined,
          hypothesis: form.hypothesis || undefined,
          variants: variants.map(v => ({
            label: v.label, name: v.name,
            ...(v.generatedMediaId ? { generatedMediaId: v.generatedMediaId } : {}),
            ...(v.cepId ? { cepId: v.cepId } : {}),
            ...(v.landingPageId ? { landingPageId: v.landingPageId } : {}),
            ...(v.offerVariantId ? { offerVariantId: v.offerVariantId } : {}),
            ...(v.metaAdId ? { metaAdId: v.metaAdId } : {}),
          })),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setCreateError(data.error ?? `Gagal (${res.status})`)
      } else {
        onCreated()
        onClose()
      }
    } catch {
      setCreateError('Koneksi error — coba lagi')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white border-l border-stone-200 shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-stone-100 px-5 py-4 flex items-center justify-between z-10">
          <h3 className="text-sm font-semibold text-stone-800">Test Baru</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Steps indicator */}
          <div className="flex items-center gap-2 text-xs font-medium text-stone-400">
            {(['Setup', `Varian (${variants.length})`, 'Confirm'] as const).map((lbl, n) => (
              <span key={n} className="flex items-center gap-2">
                {n > 0 && <span className="text-stone-300">→</span>}
                <span className={step === n ? 'text-violet-700 font-semibold' : step > n ? 'text-emerald-600' : ''}>{lbl}</span>
              </span>
            ))}
          </div>

          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Nama Test</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" placeholder="UGC vs Static" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Tipe</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white">
                    <option value="CREATIVE">Creative</option>
                    <option value="CEP">CEP</option>
                    <option value="LP">Landing Page</option>
                    <option value="PRICE">Price</option>
                    <option value="COMBINED">Combined</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Objective</label>
                  <select value={form.objective} onChange={e => setForm({ ...form, objective: e.target.value })}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white">
                    <option value="PURCHASE">Purchase</option>
                    <option value="LEADS">Leads</option>
                    <option value="ATC">Add to Cart</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Produk {needsProduct && <span className="text-amber-600">*</span>}
                </label>
                <select value={form.productId} onChange={e => setForm({ ...form, productId: e.target.value })}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="">{needsProduct ? 'Pilih produk…' : 'Semua / tanpa produk'}</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {needsProduct && !form.productId && (
                  <p className="text-[10px] text-amber-600 mt-1">Tipe {form.type} butuh produk untuk memuat pilihan varian.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Metrik Kemenangan</label>
                <select value={form.successMetric} onChange={e => setForm({ ...form, successMetric: e.target.value })}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white">
                  {ALL_METRICS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Hipotesis (opsional)</label>
                <textarea value={form.hypothesis} onChange={e => setForm({ ...form, hypothesis: e.target.value })}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Apa yang mau dibuktikan?" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="asw" checked={form.autoScaleWinner}
                  onChange={e => setForm({ ...form, autoScaleWinner: e.target.checked })}
                  className="rounded border-stone-300" />
                <label htmlFor="asw" className="text-xs text-stone-600">Auto-scale pemenang</label>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Campaign (opsional)</label>
                <select value={form.campaignSessionId} onChange={e => setForm({ ...form, campaignSessionId: e.target.value })}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="">Tanpa campaign / manual</option>
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {loadingSessions && <p className="text-[10px] text-stone-400 mt-1">Memuat campaign…</p>}
                {campaignAds.length > 0 && (
                  <p className="text-[10px] text-emerald-600 mt-1">{campaignAds.length} ad tersedia dari campaign ini</p>
                )}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-xs text-stone-500">Minimal 2 varian, maksimal 4. Setiap varian punya label (A, B, ...) dan nama unik.</p>
              {variants.map((v, i) => (
                <div key={i} className="p-3 border border-stone-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="w-6 h-6 rounded-full bg-stone-200 flex items-center justify-center text-[11px] font-bold text-stone-600">{v.label}</span>
                    {variants.length > 2 && (
                      <button onClick={() => removeVariant(i)} className="text-[11px] text-red-500 hover:text-red-700">Hapus</button>
                    )}
                  </div>
                  <input value={v.name} onChange={e => {
                    const next = [...variants]; next[i] = { ...next[i], name: e.target.value }; setVariants(next)
                  }} className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" placeholder={`Varian ${v.label} — nama`} />
                  {needsProduct && !form.productId ? (
                    <p className="text-[11px] text-stone-400 italic">Pilih produk di step Setup untuk memuat {refLabel}.</p>
                  ) : (
                    <select value={refValue(v)} onChange={e => setRefValue(i, e.target.value)}
                      className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white">
                      <option value="">{loadingOpts ? 'Memuat…' : options.length === 0 ? `Belum ada ${refLabel}` : `Pilih ${refLabel}…`}</option>
                      {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  )}
                  {form.campaignSessionId && campaignAds.length > 0 ? (
                    <div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <label className="text-[11px] font-medium text-stone-500">Meta Ad</label>
                        <button type="button" onClick={() => {
                          setShowAdPicker(prev => { const m = new Map(prev); m.set(i, !(prev.get(i) ?? true)); return m })
                        }} className="text-[10px] text-violet-700 hover:underline">
                          {showAdPicker.get(i) === false ? 'Pilih Ad dari campaign' : 'Input manual'}
                        </button>
                      </div>
                      {showAdPicker.get(i) !== false ? (
                        <select value={v.metaAdId ?? ''} onChange={e => {
                          const ad = campaignAds.find(a => a.metaEntityId === e.target.value)
                          const next = [...variants]
                          next[i] = {
                            ...next[i],
                            metaAdId: e.target.value || undefined,
                            name: (!next[i].name && ad ? ad.name : next[i].name) || '',
                          }
                          setVariants(next)
                        }} className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white mt-1">
                          <option value="">Pilih Ad…</option>
                          {campaignAds.map(ad => (
                            <option key={ad.metaEntityId} value={ad.metaEntityId}>
                              {ad.name}{ad.status ? ` (${ad.status})` : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input value={v.metaAdId ?? ''} onChange={e => {
                          const next = [...variants]; next[i] = { ...next[i], metaAdId: e.target.value || undefined }; setVariants(next)
                        }} className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm mt-1" placeholder="Meta Ad ID — manual" />
                      )}
                    </div>
                  ) : (
                    <input value={v.metaAdId ?? ''} onChange={e => {
                      const next = [...variants]; next[i] = { ...next[i], metaAdId: e.target.value || undefined }; setVariants(next)
                    }} className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" placeholder="Meta Ad ID — untuk sync metrics (opsional)" />
                  )}
                  {!form.campaignSessionId && (
                    <p className="text-[10px] text-stone-400 italic mt-1">Pilih campaign di Setup untuk ambil ad otomatis.</p>
                  )}
                  {form.campaignSessionId && campaignAds.length === 0 && (
                    <p className="text-[10px] text-amber-600 italic mt-1">Campaign ini belum punya ad tersinkron — input manual dulu atau tunggu sync campaign.</p>
                  )}
                </div>
              ))}
              {variants.length < 4 && (
                <button onClick={addVariant}
                  className="w-full py-2 text-xs font-medium text-violet-600 border-2 border-dashed border-violet-200 rounded-lg hover:bg-violet-50 transition-colors">
                  + Tambah Varian {String.fromCharCode(65 + variants.length)}
                </button>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="p-3 bg-stone-50 rounded-lg space-y-2">
                <p className="text-xs font-semibold text-stone-700">Ringkasan</p>
                <div className="text-xs text-stone-600 space-y-1">
                  <p>Nama: <span className="font-medium text-stone-800">{form.name}</span></p>
                  <p>Tipe: <span className="font-medium text-stone-800">{form.type}</span></p>
                  <p>Objective: <span className="font-medium text-stone-800">{form.objective}</span></p>
                  <p>Metrik: <span className="font-medium text-stone-800">{form.successMetric}</span></p>
                  <p>Varian: <span className="font-medium text-stone-800">{variants.map(v => `${v.label}: ${v.name}`).join(', ')}</span></p>
                  {form.autoScaleWinner && <p>Auto-scale: <span className="font-medium text-emerald-600">Aktif</span></p>}
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          {createError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {createError}
            </div>
          )}
          <div className="flex items-center justify-between pt-4 border-t border-stone-100">
            {step > 0 ? (
              <button onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 rounded-lg">
                Kembali
              </button>
            ) : <div />}
            {step < 2 ? (
              <button onClick={() => setStep(step + 1)}
                className="px-4 py-2 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700">
                Lanjut
              </button>
            ) : (
              <button onClick={createTest} disabled={submitting}
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                {submitting ? 'Membuat...' : 'Buat Test'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/* ─── Winner Modal ─── */
function WinnerModal({ test, onClose, onConfirm }: {
  test: AdTest
  onClose: () => void
  onConfirm: (testId: string, variantId: string) => void
}) {
  const sm = (ALL_METRICS.includes(test.successMetric as SuccessMetric) ? test.successMetric : 'ROAS') as SuccessMetric
  const [selected, setSelected] = useState<string>('')

  const sorted = [...test.variants].sort((a, b) => {
    const aV = getMetricValue(a, sm)
    const bV = getMetricValue(b, sm)
    if (aV === null && bV === null) return 0
    if (aV === null) return 1
    if (bV === null) return -1
    return HIB.has(sm) ? bV - aV : aV - bV
  })

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <h3 className="text-sm font-semibold text-stone-800">Declare Winner — {test.name}</h3>
            <p className="text-xs text-stone-500 mt-0.5">Metrik: {sm} (nilai lebih {HIB.has(sm) ? 'tinggi' : 'rendah'} = menang)</p>
          </div>
          <div className="p-5 space-y-3">
            {sorted.map(v => {
              const val = getMetricValue(v, sm)
              const isSelected = selected === v.id
              return (
                <button key={v.id} onClick={() => setSelected(v.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors text-left
                    ${isSelected ? 'border-violet-500 bg-violet-50' : 'border-stone-200 hover:border-stone-300'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                    ${isSelected ? 'bg-violet-600 text-white' : 'bg-stone-200 text-stone-600'}`}>
                    {v.label}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-800">{v.name}</p>
                    <p className="text-xs text-stone-500 truncate">Spend: {fmtCurrency(v.spend)} · Purch: {fmtNum(v.purchases, 0)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${isSelected ? 'text-violet-700' : 'text-stone-600'}`}>
                      {fmtMetric(v, sm)}
                    </p>
                    <p className="text-[10px] text-stone-400">{sm}</p>
                  </div>
                </button>
              )
            })}
          </div>
          <div className="px-5 py-4 border-t border-stone-100 flex items-center justify-between">
            <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 rounded-lg">Batal</button>
            <button onClick={() => selected && onConfirm(test.id, selected)} disabled={!selected}
              className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              Pilih Pemenang
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
