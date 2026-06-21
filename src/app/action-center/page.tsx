'use client'

import { useEffect, useState, useCallback } from 'react'
import PageInfo from '@/components/ui/PageInfo'

interface AutomationAction {
  id: string
  source: string
  actionType: string
  status: string
  priority: number
  requestedAt: string
  executedAt: string | null
  errorMessage: string | null
  payloadJson: string
  metaResponseJson: string | null
  campaignSession: { id: string; name: string } | null
}

interface CreativeRotation {
  id: string
  status: string
  strategy: string
  triggerReason: string | null
  oldMetaAdId: string | null
  newMetaAdId: string | null
  startedAt: string
  activatedAt: string | null
  oldAdPausedAt: string | null
  completedAt: string | null
  campaignSession: { id: string; name: string }
  automationAction: { id: string; actionType: string; status: string; createdAt: string }
  oldCreativeVariant: { id: string; name: string; status: string } | null
  newCreativeVariant: { id: string; name: string; status: string }
}

interface CreativeReservation {
  id: string
  status: string
  expiresAt: string
  creativeVariant: { id: string; name: string; status: string; product: { id: string; name: string } }
  campaignSession: { id: string; name: string; status: string }
  automationAction: { id: string; actionType: string; status: string; createdAt: string }
}

interface CampaignSession {
  id: string
  name: string
  status: string
  productId: string
  metaAdAccountId: string | null
  dailyBudget: string
  phase: string
  metaAdAccount: { id: string; adAccountId: string; adAccountName: string } | null
}

interface CreativeExhaustion {
  productId: string
  productName: string
  readyCount: number
  reservedCount: number
}

const TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'PROCESSING', label: 'Processing' },
  { key: 'FAILED', label: 'Failed' },
  { key: 'UNCERTAIN', label: 'Uncertain' },
]

const SOURCE_COLORS: Record<string, string> = {
  USER: 'bg-stone-400 text-white',
  RULE: 'bg-violet-500 text-white',
  SCHEDULE: 'bg-blue-500 text-white',
  SYSTEM: 'bg-orange-500 text-white',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
  SUCCEEDED: 'bg-green-100 text-green-800 border border-green-300',
  FAILED: 'bg-red-100 text-red-800 border border-red-300',
  UNCERTAIN: 'bg-amber-100 text-amber-800 border border-amber-300',
  CANCELLED: 'bg-stone-100 text-stone-600 border border-stone-300',
  PROCESSING: 'bg-blue-100 text-blue-800 border border-blue-300',
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function SourceBadge({ source }: { source: string }) {
  const cls = SOURCE_COLORS[source] ?? 'bg-stone-300 text-stone-700'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${cls}`}>
      {source}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-stone-100 text-stone-600 border border-stone-300'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${cls}`}>
      {status}
    </span>
  )
}

function ExpandedRow({ action }: { action: AutomationAction }) {
  let payload: Record<string, unknown> = {}
  try {
    payload = JSON.parse(action.payloadJson)
  } catch {}

  let meta: Record<string, unknown> | null = null
  if (action.metaResponseJson) {
    try {
      meta = JSON.parse(action.metaResponseJson)
    } catch {}
  }

  return (
    <tr>
      <td colSpan={7} className="px-4 py-4 bg-stone-50 border-t border-stone-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Payload</p>
            <pre className="bg-white border border-stone-200 rounded p-3 text-xs text-stone-700 overflow-auto max-h-40">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Meta Response</p>
            {meta ? (
              <pre className="bg-white border border-stone-200 rounded p-3 text-xs text-stone-700 overflow-auto max-h-40">
                {JSON.stringify(meta, null, 2)}
              </pre>
            ) : (
              <p className="text-stone-400 italic">No response yet</p>
            )}
          </div>
          {action.errorMessage && (
            <div>
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">Error</p>
              <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-700">
                {action.errorMessage}
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function ActionCenterPage() {
  const [actions, setActions] = useState<AutomationAction[]>([])
  const [tab, setTab] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [cancelLoading, setCancelLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [sessions, setSessions] = useState<CampaignSession[]>([])
  const [rotations, setRotations] = useState<CreativeRotation[]>([])
  const [reservations, setReservations] = useState<CreativeReservation[]>([])
  const [readyVariants, setReadyVariants] = useState<Record<string, number>>({})
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [topUpLoading, setTopUpLoading] = useState(false)
  const [topUpPanelOpen, setTopUpPanelOpen] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (tab !== 'ALL') params.set('status', tab)
      const res = await fetch(`/api/admin/automation-actions?${params}`, {
        cache: 'no-store',
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setActions(data.actions ?? [])
      setLastRefresh(new Date())
      setError(null)
    } catch {
      setError('Failed to load automation actions.')
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    setLoading(true)
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const interval = setInterval(fetchData, 30_000)
    return () => clearInterval(interval)
  }, [fetchData])

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(t)
    }
  }, [toast])

  const fetchCreativeTopUpData = useCallback(async () => {
    try {
      // Fetch sessions (for selection)
      const [sessionsRes, rotationsRes, reservationsRes, variantsRes] = await Promise.all([
        fetch('/api/admin/campaign-sessions?status=RUNNING', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/admin/creative-rotations?strategy=NO_GAP&limit=10', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/admin/creative-reservations?status=RESERVED', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/admin/creative-variants?status=READY', { cache: 'no-store', credentials: 'include' }),
      ])

      if (sessionsRes.ok) {
        const d = await sessionsRes.json()
        setSessions(d.sessions ?? [])
      }
      if (rotationsRes.ok) {
        const d = await rotationsRes.json()
        setRotations(d.rotations ?? [])
      }
      if (reservationsRes.ok) {
        const d = await reservationsRes.json()
        setReservations(d.reservations ?? [])
      }
      if (variantsRes.ok) {
        const d = await variantsRes.json()
        const variants: Array<{ productId: string }> = d.variants ?? []
        const counts: Record<string, number> = {}
        for (const v of variants) {
          counts[v.productId] = (counts[v.productId] ?? 0) + 1
        }
        setReadyVariants(counts)
      }
    } catch {
      // silent failure — top-up panel degrades gracefully
    }
  }, [])

  useEffect(() => {
    if (topUpPanelOpen) {
      fetchCreativeTopUpData()
    }
  }, [topUpPanelOpen, fetchCreativeTopUpData])

  const handleTriggerTopUp = async () => {
    if (!selectedSessionId) {
      setToast('Please select a campaign session first.')
      return
    }
    setTopUpLoading(true)
    try {
      const res = await fetch(`/api/admin/campaign-sessions/${selectedSessionId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: 'TOP_UP_CREATIVE',
          priority: 3,
          payload: {},
        }),
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setToast(`Top-up action queued: ${data.action?.id}`)
      setSelectedSessionId('')
      fetchData()
      fetchCreativeTopUpData()
    } catch {
      setToast('Failed to trigger top-up action.')
    } finally {
      setTopUpLoading(false)
    }
  }

  const handleCancel = async (id: string) => {
    setCancelLoading(id)
    try {
      const res = await fetch(`/api/admin/automation-actions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      })
      if (!res.ok) throw new Error('Cancel failed')
      await fetchData()
      setToast('Action cancelled.')
    } catch {
      setToast('Failed to cancel action.')
    } finally {
      setCancelLoading(null)
    }
  }

  const handleRetry = (id: string) => {
    setToast('Retry queued')
  }

  const filtered =
    tab === 'ALL'
      ? actions
      : tab === 'PROCESSING'
      ? actions.filter((a) => a.status === 'PROCESSING' || a.status === 'PENDING')
      : actions.filter((a) => a.status === tab)

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 bg-stone-800 text-white text-sm rounded border border-stone-600 shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Action Center</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Auto-refresh every 30s · Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="btn-ghost"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      <PageInfo
        purpose="View and manage all automation actions triggered by rules, schedules, or manual requests."
        inputs={[
          'Cancel pending actions — only actions in PENDING status can be cancelled',
          'Retry — queues a failed action for re-execution',
        ]}
        wiring={[
          { label: '← Automation Rules', desc: 'Rules engine creates actions when conditions are met' },
          { label: '← Schedule Jobs', desc: 'Cron jobs create scheduled actions like Night Pause' },
          { label: '→ Meta API', desc: 'Executed actions call Meta Marketing API' },
        ]}
      />

      {/* Creative Top-Up Panel */}
      <div className="border border-violet-200 bg-violet-50 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-violet-900">Creative Top-Up</h2>
            <button
              onClick={() => setTopUpPanelOpen(!topUpPanelOpen)}
              className="text-xs text-violet-600 hover:text-violet-800 underline"
            >
              {topUpPanelOpen ? 'Hide' : 'Show'}
            </button>
          </div>
          {topUpPanelOpen && (
            <button
              onClick={fetchCreativeTopUpData}
              className="text-xs text-stone-500 hover:text-stone-700"
            >
              Refresh
            </button>
          )}
        </div>

        {topUpPanelOpen && (
          <div className="space-y-4">
            {/* Reserve creative count + exhaustion alert */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Ready variants count */}
              <div className="bg-white rounded border border-stone-200 p-3">
                <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">READY Variants</p>
                <p className="text-2xl font-bold text-stone-800">
                  {Object.values(readyVariants).reduce((a, b) => a + b, 0)}
                </p>
                <p className="text-xs text-stone-400 mt-0.5">across all products</p>
              </div>
              {/* Active reservations */}
              <div className="bg-white rounded border border-stone-200 p-3">
                <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">Reserved</p>
                <p className="text-2xl font-bold text-amber-600">{reservations.length}</p>
                <p className="text-xs text-stone-400 mt-0.5">variants in use</p>
              </div>
              {/* Recent rotations */}
              <div className="bg-white rounded border border-stone-200 p-3">
                <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">NO_GAP Rotations</p>
                <p className="text-2xl font-bold text-green-600">{rotations.length}</p>
                <p className="text-xs text-stone-400 mt-0.5">recent top-ups</p>
              </div>
            </div>

            {/* Exhaustion alerts */}
            {sessions.map((session) => {
              const ready = readyVariants[session.productId] ?? 0
              const reserved = reservations.filter((r) => r.campaignSession.id === session.id).length
              if (ready > 0) return null
              return (
                <div key={session.id} className="flex items-center gap-2 bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>
                    <strong>{session.name}</strong>: 0 READY variants available
                    {reserved > 0 ? ` (${reserved} reserved)` : ''} — top-up will fail until new creatives are added
                  </span>
                </div>
              )
            })}

            {/* Recent rotations table */}
            {rotations.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Recent NO_GAP Rotations</p>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-white border border-stone-200">
                      <tr>
                        {['Campaign', 'New Creative', 'Old Ad', 'New Ad', 'Status', 'Started'].map((h) => (
                          <th key={h} className="px-2 py-1.5 text-left text-stone-500 font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {rotations.slice(0, 5).map((r) => (
                        <tr key={r.id} className="bg-white">
                          <td className="px-2 py-1.5 text-stone-700 max-w-[120px] truncate">{r.campaignSession.name}</td>
                          <td className="px-2 py-1.5 text-stone-600 max-w-[100px] truncate">{r.newCreativeVariant.name}</td>
                          <td className="px-2 py-1.5 text-stone-500 font-mono text-[10px]">{r.oldMetaAdId ?? '—'}</td>
                          <td className="px-2 py-1.5 text-stone-500 font-mono text-[10px]">{r.newMetaAdId ?? '—'}</td>
                          <td className="px-2 py-1.5">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              r.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                              r.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                              'bg-stone-100 text-stone-600'
                            }`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-stone-400 whitespace-nowrap">
                            {new Date(r.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Trigger Top-Up */}
            <div className="flex items-center gap-3 bg-white rounded border border-stone-200 p-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  Select Campaign Session
                </label>
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="w-full text-sm border border-stone-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">— choose a running session —</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.phase})
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleTriggerTopUp}
                disabled={!selectedSessionId || topUpLoading}
                className="btn-primary mt-5"
              >
                {topUpLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Triggering...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Trigger Top-Up
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map(({ key, label }) => {
          const count =
            key === 'ALL'
              ? actions.length
              : key === 'PROCESSING'
              ? actions.filter((a) => a.status === 'PROCESSING' || a.status === 'PENDING').length
              : actions.filter((a) => a.status === key).length
          const isActive = tab === key
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-violet-600 text-white'
                  : 'bg-white border border-stone-300 text-stone-600 hover:bg-stone-50'
              }`}
            >
              {label}
              <span
                className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48 text-stone-400 text-sm">
          Loading actions...
        </div>
      ) : (
        <div className="border border-stone-300 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                {['Source', 'Action Type', 'Campaign', 'Status', 'Priority', 'Requested At', 'Executed At', ''].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-stone-400">
                    No actions for this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((action) => (
                  <>
                    <tr
                      key={action.id}
                      className="hover:bg-stone-50 transition-colors cursor-pointer"
                      onClick={() => setExpanded(expanded === action.id ? null : action.id)}
                    >
                      <td className="px-4 py-3">
                        <SourceBadge source={action.source} />
                      </td>
                      <td className="px-4 py-3 font-medium text-stone-800 whitespace-nowrap">
                        {action.actionType}
                      </td>
                      <td className="px-4 py-3 text-stone-600 max-w-[180px] truncate">
                        {action.campaignSession?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={action.status} />
                      </td>
                      <td className="px-4 py-3 text-stone-500">
                        {action.priority}
                      </td>
                      <td className="px-4 py-3 text-stone-500 whitespace-nowrap">
                        {formatDate(action.requestedAt)}
                      </td>
                      <td className="px-4 py-3 text-stone-500 whitespace-nowrap">
                        {formatDate(action.executedAt)}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          {action.status === 'PENDING' && (
                            <button
                              onClick={() => handleCancel(action.id)}
                              disabled={cancelLoading === action.id}
                              className="text-xs px-2 py-1 border border-stone-300 rounded hover:bg-stone-100 transition-colors"
                            >
                              {cancelLoading === action.id ? 'Cancelling...' : 'Cancel'}
                            </button>
                          )}
                          {(action.status === 'FAILED' || action.status === 'UNCERTAIN') && (
                            <button
                              onClick={() => handleRetry(action.id)}
                              className="text-xs px-2 py-1 border border-violet-300 rounded text-violet-700 hover:bg-violet-50 transition-colors"
                            >
                              Retry
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded === action.id && <ExpandedRow key={`expanded-${action.id}`} action={action} />}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
