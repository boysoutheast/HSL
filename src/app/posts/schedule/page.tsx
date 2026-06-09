'use client'

import { useEffect, useState } from 'react'
import PageInfo from '@/components/ui/PageInfo'
import Table from '@/components/ui/Table'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'

interface MetaSchedule {
  id: string
  title: string | null
  scheduledFor: string
  status: string
  attempts: number
  lastError: string | null
  metaPage: { id: string; pageId: string; pageName: string } | null
  metaPost: { id: string; title: string | null; message: string | null; status: string } | null
}

interface SchedulesResponse {
  schedules: MetaSchedule[]
  total: number
  pagination: { page: number; limit: number; total: number }
}

export default function SchedulePage() {
  const [data, setData] = useState<SchedulesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('')
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; scheduleId: string | null }>({ open: false, scheduleId: null })
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchSchedules = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/schedules?limit=100')
      if (!res.ok) throw new Error('Failed to fetch schedules')
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSchedules()
  }, [])

  const handleRetry = async (id: string) => {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/admin/schedules/${id}/retry`, { method: 'POST' })
      if (!res.ok) throw new Error('Retry failed')
      fetchSchedules()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Retry failed')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteModal.scheduleId) return
    setActionLoading('deleting')
    try {
      const res = await fetch(`/api/admin/schedules/${deleteModal.scheduleId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setDeleteModal({ open: false, scheduleId: null })
      fetchSchedules()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setActionLoading(null)
    }
  }

  const handleClearAllFailed = async () => {
    if (!confirm('Delete all failed schedules?')) return
    setActionLoading('clear_all')
    try {
      const res = await fetch('/api/admin/schedules/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'failed' }),
      })
      if (!res.ok) throw new Error('Clear failed failed')
      fetchSchedules()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Clear all failed failed')
    } finally {
      setActionLoading(null)
    }
  }

  const filteredSchedules = data?.schedules.filter(s => {
    if (!filter) return true
    const q = filter.toLowerCase()
    return (
      s.title?.toLowerCase().includes(q) ||
      s.metaPage?.pageName.toLowerCase().includes(q) ||
      s.metaPost?.title?.toLowerCase().includes(q)
    )
  }) ?? []

  const failedCount = data?.schedules.filter(s => s.status === 'failed').length ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Schedule</h1>
          <p className="section-sub">View and manage recurring scheduled posts.</p>
        </div>
        <a href="/posts/schedule/new" className="btn-primary">
          + New Schedule
        </a>
      </div>

      <PageInfo
        purpose="Automate recurring posts on a fixed schedule. Set time, repeat interval, and platform."
        inputs={['Post content', 'Schedule time', 'Repeat interval (daily/weekly/monthly)', 'Platform']}
      />

      <div className="card">
        <div className="px-4 py-3 border-b border-stone-200 flex gap-3 items-center flex-wrap">
          <input
            type="text"
            placeholder="Filter schedules..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="input-field text-sm flex-1 min-w-[200px]"
          />
          {failedCount > 0 && (
            <button
              onClick={handleClearAllFailed}
              className="btn-error text-sm"
              disabled={actionLoading === 'clear_all'}
            >
              {actionLoading === 'clear_all' ? 'Clearing...' : `Clear All Failed (${failedCount})`}
            </button>
          )}
          <button onClick={fetchSchedules} className="btn-secondary text-sm" disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-6 w-6 border-2 border-violet-600 border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="px-4 py-8 text-center text-red-600">{error}</div>
        ) : (
          <Table
            headers={['Title', 'Platform', 'Status', 'Scheduled For', 'Attempts', 'Actions']}
            empty="No schedules found."
          >
            {filteredSchedules.map(s => (
              <tr key={s.id}>
                <td className="px-4 py-3">
                  <span className="font-medium">{s.title || s.metaPost?.title || 'Untitled'}</span>
                  {s.lastError && (
                    <p className="text-xs text-red-500 truncate max-w-[200px] mt-0.5" title={s.lastError}>
                      Error: {s.lastError}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-stone-600">{s.metaPage?.pageName ?? '—'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-4 py-3 text-stone-500 text-sm">
                  {new Date(s.scheduledFor).toLocaleString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="px-4 py-3 text-stone-500">{s.attempts}</td>
                <td className="px-4 py-3 flex gap-2">
                  {s.status === 'failed' && (
                    <button
                      onClick={() => handleRetry(s.id)}
                      disabled={actionLoading === s.id}
                      className="text-violet-600 hover:text-violet-800 text-sm disabled:opacity-50"
                    >
                      {actionLoading === s.id ? 'Retrying...' : 'Retry'}
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteModal({ open: true, scheduleId: s.id })}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      <Modal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, scheduleId: null })}
        title="Delete Schedule"
      >
        <p className="text-stone-600 mb-4">Are you sure you want to delete this schedule? This action cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setDeleteModal({ open: false, scheduleId: null })}
            className="btn-secondary"
            disabled={actionLoading === 'deleting'}
          >
            Cancel
          </button>
          <button onClick={handleDelete} className="btn-error" disabled={actionLoading === 'deleting'}>
            {actionLoading === 'deleting' ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
