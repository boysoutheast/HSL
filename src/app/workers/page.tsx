'use client'

import { useEffect, useState, useCallback } from 'react'
import PageInfo from '@/components/ui/PageInfo'
import StatusBadge from '@/components/ui/StatusBadge'
import Table from '@/components/ui/Table'

interface WorkerTask {
  id: string
  type: string
  capability: string | null
  status: string
  priority: number
  attempts: number
  maxAttempts: number
  workerId: string | null
  lastError: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  results: Array<{ id: string; resultType: string; mediaAssetId: string | null }>
}

interface Agent {
  id: string
  name: string
  status: string
  lastUsedAt?: string | null
}

const STATUS_FILTERS = ['all', 'pending', 'processing', 'completed', 'failed', 'dead_letter'] as const

export default function WorkersPage() {
  const [tasks, setTasks] = useState<WorkerTask[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [agents, setAgents] = useState<Agent[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    try {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : ''
      const res = await fetch(`/api/admin/worker-tasks${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setTasks(data.tasks ?? [])
      setCounts(data.counts ?? {})
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => {
    fetchTasks()
    fetch('/api/admin/hermes-agents', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(d => setAgents(Array.isArray(d) ? d : d.agents ?? []))
      .catch(() => {})
  }, [fetchTasks])

  const fmtTime = (s: string | null) =>
    s ? new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Workers & Task Queue</h1>
          <p className="text-sm text-stone-500 mt-0.5">Status Hermes workers dan antrian task.</p>
        </div>
        <button onClick={() => { setLoading(true); fetchTasks() }} className="btn-ghost btn-sm">↻ Refresh</button>
      </div>

      <PageInfo
        purpose="Monitor antrian task untuk worker (generate konten, automation Meta) dan status agents."
        wiring={[
          { label: '← Media Rules', desc: 'rule yang trigger bikin task di sini' },
          { label: '← Test Launches', desc: 'launch yang di-approve jadi task create_campaign' },
          { label: '→ Hermes /tasks', desc: 'worker claim + complete via API' },
        ]}
      />

      {/* Status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {(['pending', 'processing', 'completed', 'failed', 'dead_letter'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
            className={`card-hover p-3 text-left ${statusFilter === s ? 'ring-2 ring-violet-500' : ''}`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">{s.replace('_', ' ')}</p>
            <p className="text-xl font-bold text-stone-900 dark:text-stone-100 mt-0.5">{counts[s] ?? 0}</p>
          </button>
        ))}
      </div>

      {/* Agents */}
      {agents.length > 0 && (
        <div className="mb-6">
          <h2 className="section-title mb-2">Hermes Agents ({agents.length})</h2>
          <div className="flex flex-wrap gap-2">
            {agents.map(a => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-2 card text-sm">
                <StatusBadge status={a.status} />
                <span className="font-medium text-stone-700 dark:text-stone-300">{a.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task queue */}
      <div className="flex items-center gap-1 mb-3">
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              statusFilter === s
                ? 'bg-violet-600 text-white'
                : 'text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            {s === 'all' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-stone-400 text-sm">Loading tasks...</div>
      ) : (
        <Table
          headers={['Type', 'Capability', 'Status', 'Worker', 'Attempts', 'Created', 'Completed', 'Result']}
          empty="Tidak ada task."
        >
          {tasks.map(task => (
            <tr key={task.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors">
              <td className="px-4 py-3 font-mono text-xs text-stone-700 dark:text-stone-300">{task.type}</td>
              <td className="px-4 py-3 text-xs text-stone-500">{task.capability ?? '—'}</td>
              <td className="px-4 py-3">
                <StatusBadge status={
                  task.status === 'completed' ? 'active'
                  : task.status === 'processing' ? 'monitoring'
                  : task.status === 'pending' ? 'pending'
                  : 'error'
                } />
                {task.lastError && (
                  <p className="text-[10px] text-red-500 mt-1 max-w-[200px] truncate" title={task.lastError}>{task.lastError}</p>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-stone-500 max-w-[140px] truncate">{task.workerId ?? '—'}</td>
              <td className="px-4 py-3 text-xs text-stone-500">{task.attempts}/{task.maxAttempts}</td>
              <td className="px-4 py-3 text-xs text-stone-400 whitespace-nowrap">{fmtTime(task.createdAt)}</td>
              <td className="px-4 py-3 text-xs text-stone-400 whitespace-nowrap">{fmtTime(task.completedAt)}</td>
              <td className="px-4 py-3 text-xs text-stone-500">
                {task.results.length > 0 ? task.results.map(r => r.resultType).join(', ') : '—'}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
