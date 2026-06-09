'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface DeadLetterEntry {
  id: string
  workerTaskId: string
  actionId: string | null
  taskType: string
  payloadJson: string
  errorCode: string
  errorMessage: string
  attemptCount: number
  status: 'PENDING' | 'REVIEWED' | 'RETRIED' | 'ARCHIVED'
  assignedTo: string | null
  resolution: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

interface Stats {
  total: number
  byStatus: Record<string, number>
  byTaskType: Record<string, number>
  oldestCreatedAt: string | null
  recentCount24h: number
}

type FilterTab = 'ALL' | 'PENDING' | 'REVIEWED'

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  REVIEWED: 'Reviewed',
  RETRIED: 'Retried',
  ARCHIVED: 'Archived',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  REVIEWED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  RETRIED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  ARCHIVED: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400',
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-stone-100 text-stone-600'
  const label = STATUS_LABELS[status] ?? status
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {label}
    </span>
  )
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

export default function DeadLettersPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ role: string } | null>(null)
  const [entries, setEntries] = useState<DeadLetterEntry[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL')
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/auth/me', { credentials: 'include' })
      if (!res.ok) { router.push('/login'); return }
      const data = await res.json()
      if (!data.user || data.user.role !== 'admin') { router.push('/'); return }
      setUser(data.user)
    } catch {
      router.push('/login')
    }
  }, [router])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/dead-letters/stats', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch { /* silent */ }
  }, [])

  const fetchEntries = useCallback(async (tab: FilterTab) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (tab !== 'ALL') params.set('status', tab)
      const res = await fetch(`/api/admin/dead-letters?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setEntries(data.entries ?? [])
    } catch (e) {
      setError('Failed to load dead letters')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  useEffect(() => {
    if (!user) return
    fetchStats()
    fetchEntries(activeTab)
  }, [user, activeTab, fetchStats, fetchEntries])

  async function handleRetry(id: string) {
    setActioningId(id)
    try {
      const res = await fetch(`/api/admin/dead-letters/retry/${id}`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error ?? 'Retry failed')
        return
      }
      await fetchEntries(activeTab)
      await fetchStats()
    } finally {
      setActioningId(null)
    }
  }

  async function handleArchive(id: string) {
    if (!confirm('Archive this dead letter entry?')) return
    setActioningId(id)
    try {
      await fetch(`/api/admin/dead-letters/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      await fetchEntries(activeTab)
      await fetchStats()
    } finally {
      setActioningId(null)
    }
  }

  async function handleReview(id: string) {
    setActioningId(id)
    try {
      await fetch(`/api/admin/dead-letters/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REVIEWED' }),
      })
      await fetchEntries(activeTab)
      await fetchStats()
    } finally {
      setActioningId(null)
    }
  }

  if (!user) return null

  const pendingCount = stats?.byStatus?.PENDING ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">Dead Letters</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Tasks that exceeded max retry attempts — review and retry or archive
          </p>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 p-4">
            <div className="text-2xl font-bold text-stone-900 dark:text-stone-100">{stats.total}</div>
            <div className="text-xs text-stone-500 mt-0.5">Total DL Entries</div>
          </div>
          <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 p-4">
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
            <div className="text-xs text-stone-500 mt-0.5">Pending Review</div>
          </div>
          <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 p-4">
            <div className="text-2xl font-bold text-orange-600">{stats.recentCount24h}</div>
            <div className="text-xs text-stone-500 mt-0.5">Last 24 Hours</div>
          </div>
          <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 p-4">
            <div className="text-2xl font-bold text-stone-600 dark:text-stone-400">
              {stats.oldestCreatedAt ? formatRelativeTime(stats.oldestCreatedAt) : '—'}
            </div>
            <div className="text-xs text-stone-500 mt-0.5">Oldest Entry</div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1 border-b border-stone-200 dark:border-stone-700">
        {(['ALL', 'PENDING', 'REVIEWED'] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
            }`}
          >
            {tab === 'ALL' ? 'All' : STATUS_LABELS[tab]}
            {tab === 'PENDING' && pendingCount > 0 && (
              <span className="ml-1.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 text-xs px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-stone-400">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📭</div>
          <div className="text-stone-500 text-sm">No dead letter entries</div>
        </div>
      ) : (
        <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700 overflow-hidden">
          <table className="min-w-full divide-y divide-stone-200 dark:divide-stone-700">
            <thead className="bg-stone-50 dark:bg-stone-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Task ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Error</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Attempts</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Created</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 dark:divide-stone-700">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/30">
                  <td className="px-4 py-3">
                    <code className="text-xs text-stone-600 dark:text-stone-400 font-mono">{entry.workerTaskId.slice(0, 12)}…</code>
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-700 dark:text-stone-300">{entry.taskType}</td>
                  <td className="px-4 py-3 max-w-xs">
                    <div className="text-xs text-red-600 dark:text-red-400 font-medium">{entry.errorCode}</div>
                    <div className="text-xs text-stone-500 dark:text-stone-400 truncate max-w-xs">{entry.errorMessage}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-600 dark:text-stone-400">
                    <span className={entry.attemptCount >= 3 ? 'text-red-600 font-medium' : ''}>
                      {entry.attemptCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-500 dark:text-stone-400">
                    {formatRelativeTime(entry.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={entry.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {entry.status === 'PENDING' && (
                        <button
                          onClick={() => handleReview(entry.id)}
                          disabled={actioningId === entry.id}
                          className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-100 dark:hover:bg-blue-900 disabled:opacity-50 transition-colors"
                        >
                          Review
                        </button>
                      )}
                      {(entry.status === 'PENDING' || entry.status === 'REVIEWED') && (
                        <button
                          onClick={() => handleRetry(entry.id)}
                          disabled={actioningId === entry.id}
                          className="text-xs px-2 py-1 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 rounded hover:bg-green-100 dark:hover:bg-green-900 disabled:opacity-50 transition-colors"
                        >
                          {actioningId === entry.id ? 'Retrying...' : 'Retry'}
                        </button>
                      )}
                      {entry.status !== 'ARCHIVED' && (
                        <button
                          onClick={() => handleArchive(entry.id)}
                          disabled={actioningId === entry.id}
                          className="text-xs px-2 py-1 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 rounded hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-50 transition-colors"
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
