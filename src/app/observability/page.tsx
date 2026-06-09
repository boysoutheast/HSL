'use client'

import { useEffect, useState, useCallback } from 'react'
import PageInfo from '@/components/ui/PageInfo'

// ── Types ────────────────────────────────────────────────────────────────────

interface QueueData {
  totalPending: number
  oldestPendingAge: number
  byPriority: { P0: number; P1: number; P2: number; P3: number }
  byCapability: Record<string, number>
}

interface WorkerPool {
  mode: string
  count: number
  lastHeartbeat: string | null
  activeTasks: number
}

interface ActionHealth {
  total: number
  succeeded: number
  failed: number
  uncertain: number
  pending: number
}

interface MetaError {
  id: string
  actionType: string
  errorCode: string | null
  errorMessage: string | null
  status: string
  requestedAt: string
  campaignSession: { id: string; name: string } | null
}

interface MetaErrorsData {
  errors: MetaError[]
  totalCount: number
  errorRate: number
}

interface AlertConfig {
  key: string
  name: string
  description: string
  threshold: number
  unit: string
  channel: string
  enabled: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

function formatHeartbeat(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// ── Card Components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className={`rounded-lg border bg-white p-4 shadow-sm ${accent ? `border-l-4 ${accent}` : 'border-stone-200'}`}>
      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold text-stone-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-stone-400">{sub}</p>}
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <h2 className="text-base font-semibold text-stone-800">{title}</h2>
      <div className="flex-1 border-t border-stone-200" />
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ObservabilityPage() {
  const [queue, setQueue] = useState<QueueData | null>(null)
  const [workers, setWorkers] = useState<WorkerPool[]>([])
  const [actions, setActions] = useState<ActionHealth | null>(null)
  const [metaErrors, setMetaErrors] = useState<MetaErrorsData | null>(null)
  const [alerts, setAlerts] = useState<AlertConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [error, setError] = useState<string | null>(null)
  const [patching, setPatching] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setError(null)
    try {
      const [q, w, a, me, al] = await Promise.all([
        fetch('/api/admin/observability/queue', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/admin/observability/workers', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/admin/observability/actions', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/admin/observability/meta-errors', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/admin/observability/alerts', { credentials: 'include' }).then(r => r.json()),
      ])
      setQueue(q)
      setWorkers(w.pools ?? [])
      setActions(a)
      setMetaErrors(me)
      setAlerts(al.alerts ?? [])
      setLastRefresh(new Date())
    } catch {
      setError('Failed to load observability data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 30_000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const toggleAlert = async (key: string, enabled: boolean) => {
    setPatching(key)
    try {
      const res = await fetch('/api/admin/observability/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key, enabled }),
      })
      if (!res.ok) throw new Error('Failed')
      setAlerts(prev => prev.map(a => a.key === key ? { ...a, enabled } : a))
    } catch {
      alert('Failed to update alert config')
    } finally {
      setPatching(null)
    }
  }

  const updateThreshold = async (key: string, threshold: number) => {
    setPatching(key)
    try {
      const res = await fetch('/api/admin/observability/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key, threshold }),
      })
      if (!res.ok) throw new Error('Failed')
      setAlerts(prev => prev.map(a => a.key === key ? { ...a, threshold } : a))
    } catch {
      alert('Failed to update threshold')
    } finally {
      setPatching(null)
    }
  }

  const errorRateColor = (metaErrors?.errorRate ?? 0) > 10 ? 'text-red-600' : (metaErrors?.errorRate ?? 0) > 5 ? 'text-amber-600' : 'text-emerald-600'
  const uncertainPct = actions && actions.total > 0 ? Math.round((actions.uncertain / actions.total) * 100) : 0
  const failedPct = actions && actions.total > 0 ? Math.round((actions.failed / actions.total) * 100) : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Observability Dashboard</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Auto-refresh every 30s · Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      <PageInfo
        purpose="Real-time health monitoring for the Hermes worker system. Shows queue depth, worker status, action outcomes, and Meta API reliability."
        inputs={[
          'Auto-populated from WorkerTask, WorkerRegistry, and AutomationAction tables',
          'Alert thresholds stored in FeatureFlag records, editable below',
        ]}
        wiring={[
          { label: '→ Worker nodes', desc: 'Heartbeat at /api/internal/worker/heartbeat — updates WorkerRegistry' },
          { label: '→ Hermes agents', desc: 'Poll /api/hermes/ready-upload and post results to /api/hermes/content-log' },
          { label: '→ Cron jobs', desc: 'WorkerTask cleanup and monitoring runs on schedule' },
        ]}
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48 text-stone-400 text-sm">Loading observability data...</div>
      ) : (
        <div className="space-y-8">

          {/* ── 1. Queue Health ── */}
          <div>
            <SectionHeader title="1. Queue Health" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
              <StatCard
                label="Total Pending"
                value={queue?.totalPending ?? 0}
                sub="active tasks"
                accent="border-violet-500"
              />
              <StatCard
                label="Oldest Pending"
                value={formatAge(queue?.oldestPendingAge ?? 0)}
                sub="age of oldest task"
                accent={(queue?.oldestPendingAge ?? 0) > 300 ? 'border-red-500' : 'border-stone-200'}
              />
              <StatCard label="P0 (Critical)" value={queue?.byPriority.P0 ?? 0} accent="border-red-500" />
              <StatCard label="P1 (High)" value={queue?.byPriority.P1 ?? 0} accent="border-orange-500" />
              <StatCard label="P2 (Medium)" value={queue?.byPriority.P2 ?? 0} accent="border-amber-500" />
              <StatCard label="P3 (Low)" value={queue?.byPriority.P3 ?? 0} accent="border-stone-200" />
            </div>

            {/* By Capability breakdown */}
            <div className="mt-3 p-4 bg-white rounded-lg border border-stone-200">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Tasks by Capability</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(queue?.byCapability ?? {}).map(([cap, count]) => (
                  <div key={cap} className="text-center">
                    <p className="text-lg font-bold text-stone-700">{count}</p>
                    <p className="text-xs text-stone-500 capitalize">{cap.replace('_', ' ')}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── 2. Worker Pool Status ── */}
          <div>
            <SectionHeader title="2. Worker Pool Status" />
            <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-stone-50">
                  <tr>
                    {['Pool', 'Workers', 'Active Tasks', 'Last Heartbeat', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {workers.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-stone-400">No active workers</td></tr>
                  ) : workers.map(pool => {
                    const isStale = pool.lastHeartbeat && (Date.now() - new Date(pool.lastHeartbeat).getTime()) > 120_000
                    return (
                      <tr key={pool.mode} className="hover:bg-stone-50">
                        <td className="px-4 py-3 font-medium text-stone-800">{pool.mode}</td>
                        <td className="px-4 py-3 text-stone-600">{pool.count}</td>
                        <td className="px-4 py-3">
                          <span className={`font-medium ${pool.activeTasks > 0 ? 'text-violet-700' : 'text-stone-500'}`}>
                            {pool.activeTasks}
                          </span>
                        </td>
                        <td className={`px-4 py-3 ${isStale ? 'text-amber-600' : 'text-stone-500'}`}>
                          {formatHeartbeat(pool.lastHeartbeat)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                            isStale
                              ? 'bg-amber-100 text-amber-700'
                              : pool.activeTasks > 0
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-stone-100 text-stone-500'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isStale ? 'bg-amber-500' : pool.activeTasks > 0 ? 'bg-emerald-500' : 'bg-stone-400'}`} />
                            {isStale ? 'Stale' : pool.activeTasks > 0 ? 'Active' : 'Idle'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── 3. Action Health ── */}
          <div>
            <SectionHeader title="3. Action Health (24h)" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <StatCard label="Total Actions" value={actions?.total ?? 0} accent="border-stone-200" />
              <StatCard label="Succeeded" value={actions?.succeeded ?? 0} sub={`${actions && actions.total > 0 ? Math.round((actions.succeeded / actions.total) * 100) : 0}%`} accent="border-emerald-500" />
              <StatCard label="Failed" value={actions?.failed ?? 0} sub={`${failedPct}%`} accent="border-red-500" />
              <StatCard label="Uncertain" value={actions?.uncertain ?? 0} sub={`${uncertainPct}%`} accent="border-amber-500" />
              <StatCard label="Pending" value={actions?.pending ?? 0} accent="border-stone-200" />
            </div>

            {/* Action bar visualization */}
            {actions && actions.total > 0 && (
              <div className="mt-2 h-3 rounded-full bg-stone-100 overflow-hidden flex">
                <div className="bg-emerald-500 h-full transition-all" style={{ width: `${Math.round((actions.succeeded / actions.total) * 100)}%` }} />
                <div className="bg-red-500 h-full transition-all" style={{ width: `${Math.round((actions.failed / actions.total) * 100)}%` }} />
                <div className="bg-amber-500 h-full transition-all" style={{ width: `${Math.round((actions.uncertain / actions.total) * 100)}%` }} />
                <div className="bg-stone-300 h-full transition-all" style={{ width: `${Math.round((actions.pending / actions.total) * 100)}%` }} />
              </div>
            )}
          </div>

          {/* ── 4. Meta Error Rate ── */}
          <div>
            <SectionHeader title="4. Meta API Error Rate (24h)" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              <StatCard
                label="Error Count"
                value={metaErrors?.totalCount ?? 0}
                accent="border-red-500"
              />
              <StatCard
                label="Error Rate"
                value={`${metaErrors?.errorRate ?? 0}%`}
                sub="of all actions"
                accent={(metaErrors?.errorRate ?? 0) > 10 ? 'border-red-500' : (metaErrors?.errorRate ?? 0) > 5 ? 'border-amber-500' : 'border-emerald-500'}
              />
              <StatCard
                label="Success Rate"
                value={`${100 - (metaErrors?.errorRate ?? 0)}%`}
                sub="approximate"
                accent={(metaErrors?.errorRate ?? 0) <= 5 ? 'border-emerald-500' : 'border-stone-200'}
              />
            </div>

            {/* Recent errors table */}
            {metaErrors && metaErrors.errors.length > 0 && (
              <div className="mt-3 bg-white rounded-lg border border-stone-200 overflow-hidden">
                <p className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide bg-stone-50">Recent Meta Errors</p>
                <table className="min-w-full text-sm">
                  <thead>
                    <tr>
                      {['Time', 'Action', 'Error Code', 'Message', 'Session'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-medium text-stone-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {metaErrors.errors.slice(0, 10).map(err => (
                      <tr key={err.id} className="hover:bg-stone-50">
                        <td className="px-4 py-2 text-stone-500 whitespace-nowrap">{formatDate(err.requestedAt)}</td>
                        <td className="px-4 py-2 text-stone-700">{err.actionType}</td>
                        <td className="px-4 py-2">
                          <span className="text-xs font-mono bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{err.errorCode ?? '—'}</span>
                        </td>
                        <td className="px-4 py-2 text-stone-500 max-w-[200px] truncate">{err.errorMessage ?? '—'}</td>
                        <td className="px-4 py-2 text-stone-400 text-xs">{err.campaignSession?.name ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── 5. Alert Configuration ── */}
          <div>
            <SectionHeader title="5. Alert Configuration" />
            <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-stone-50">
                  <tr>
                    {['Alert', 'Threshold', 'Unit', 'Channel', 'Enabled', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {alerts.map(alert => (
                    <tr key={alert.key} className="hover:bg-stone-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-stone-800">{alert.name}</p>
                        <p className="text-xs text-stone-400 mt-0.5">{alert.description}</p>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          className="w-20 px-2 py-1 text-sm border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-violet-500"
                          defaultValue={alert.threshold}
                          onBlur={e => {
                            const v = parseInt(e.target.value)
                            if (!isNaN(v) && v !== alert.threshold) updateThreshold(alert.key, v)
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 text-stone-500">{alert.unit}</td>
                      <td className="px-4 py-3 text-stone-500">{alert.channel}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleAlert(alert.key, !alert.enabled)}
                          disabled={patching === alert.key}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            alert.enabled ? 'bg-emerald-500' : 'bg-stone-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              alert.enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${alert.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                          {alert.enabled ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
