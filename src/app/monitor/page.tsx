'use client'

import { useEffect, useState, useCallback } from 'react'
import StatusBadge from '@/components/ui/StatusBadge'
import PageInfo from '@/components/ui/PageInfo'

interface MonitorEntry {
  id: string
  status: string
  reason: string | null
  currentViews: number
  growthPerHour: number
  lastPostAt: string | null
  lastMetricsCheckAt: string | null
  instagramAccount: {
    id: string
    username: string
  }
  hermesAgent: {
    id: string
    name: string
  } | null
}

const FILTER_OPTIONS = [
  { label: 'All', value: 'ALL' },
  { label: 'Ready Upload', value: 'READY_UPLOAD' },
  { label: 'Still Growing', value: 'STILL_GROWING' },
  { label: 'Hot Video', value: 'HOT_VIDEO' },
  { label: 'Need New Video', value: 'NEED_NEW_VIDEO' },
  { label: 'Error', value: 'ERROR' },
]

const FILTER_ACTIVE_COLORS: Record<string, string> = {
  ALL: 'bg-violet-600 text-white',
  READY_UPLOAD: 'bg-emerald-600 text-white',
  STILL_GROWING: 'bg-cyan-600 text-white',
  HOT_VIDEO: 'bg-orange-500 text-white',
  NEED_NEW_VIDEO: 'bg-amber-500 text-white',
  ERROR: 'bg-red-600 text-white',
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

export default function MonitorPage() {
  const [entries, setEntries] = useState<MonitorEntry[]>([])
  const [filter, setFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/posting-monitor', { cache: 'no-store', credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      // API returns { monitors: [...], unmonitoredAccounts: [...], summary: {...} }
      setEntries(data.monitors ?? [])
      setLastRefresh(new Date())
      setError(null)
    } catch {
      setError('Failed to load posting monitor data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60_000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleAction = async (accountId: string, action: 'set_ready' | 'lock') => {
    setActionLoading(`${accountId}-${action}`)
    try {
      const res = await fetch(`/api/admin/posting-monitor/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error('Action failed')
      await fetchData()
    } catch {
      alert('Action failed. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const filtered =
    filter === 'ALL' ? entries : entries.filter((e) => e.status === filter)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Ready Upload Dashboard</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Auto-refresh every 60s · Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      <PageInfo
        purpose="Pantau status semua akun IG secara real-time. AI Buddy mengambil akun dari sini untuk tahu kapan harus upload video baru."
        inputs={[
          'Tidak ada input manual — status dihitung otomatis tiap jam oleh cron',
          'Manual override: tombol \'Set Ready\' atau \'Lock\' untuk force status',
        ]}
        wiring={[
          { label: '→ Hermes Agent', desc: 'GET /api/hermes/ready-upload — Hermes polling endpoint ini' },
          { label: '← Cron Job', desc: '/api/cron/posting-monitor jalan tiap jam update status ini' },
          { label: '← Content Log', desc: 'setelah AI Buddy posting, status berubah ke MONITORING' },
        ]}
      />

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTER_OPTIONS.map(({ label, value }) => {
          const count =
            value === 'ALL'
              ? entries.length
              : entries.filter((e) => e.status === value).length
          const isActive = filter === value
          return (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                isActive
                  ? FILTER_ACTIVE_COLORS[value] ?? 'bg-violet-600 text-white'
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
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48 text-stone-400 text-sm">
          Loading monitor data...
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-stone-50">
              <tr>
                {['Account IG', 'Status', 'Last Post', 'Views', 'Growth/hr', 'Reason', 'Assigned Agent', 'Last Check', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-stone-400">
                    No entries for this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((entry) => (
                  <tr key={entry.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-violet-700">
                      <a
                        href={`https://instagram.com/${entry.instagramAccount.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        @{entry.instagramAccount.username}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={entry.status} />
                    </td>
                    <td className="px-4 py-3 text-stone-500 whitespace-nowrap">
                      {formatDate(entry.lastPostAt)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {entry.currentViews.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-medium ${
                          entry.growthPerHour > 20
                            ? 'text-orange-600'
                            : entry.growthPerHour > 10
                            ? 'text-cyan-600'
                            : entry.growthPerHour > 3
                            ? 'text-green-600'
                            : 'text-stone-500'
                        }`}
                      >
                        {entry.growthPerHour.toFixed(1)}%/hr
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-500 max-w-[200px] truncate">
                      {entry.reason ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {entry.hermesAgent?.name ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-stone-500 whitespace-nowrap">
                      {formatDate(entry.lastMetricsCheckAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAction(entry.instagramAccount.id, 'set_ready')}
                          disabled={actionLoading === `${entry.instagramAccount.id}-set_ready`}
                          className="btn-success btn-sm"
                        >
                          Set Ready
                        </button>
                        <button
                          onClick={() => handleAction(entry.instagramAccount.id, 'lock')}
                          disabled={actionLoading === `${entry.instagramAccount.id}-lock`}
                          className="btn-purple btn-sm"
                        >
                          Lock
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
