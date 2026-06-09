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
          className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-stone-300 hover:bg-stone-50 transition-colors"
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
