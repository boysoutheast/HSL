'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import StatusBadge from '@/components/ui/StatusBadge'
import PageInfo from '@/components/ui/PageInfo'

export default function LogsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading...</div>}>
      <LogsPageInner />
    </Suspense>
  )
}

interface ContentLog {
  id: string
  status: string
  prompt: string
  script: string | null
  caption: string | null
  postUrl: string | null
  postedAt: string | null
  createdAt: string
  hermesAgent: { id: string; name: string }
  instagramAccount: { id: string; username: string }
  character: { id: string; name: string } | null
  topic: { id: string; name: string } | null
  cep: { id: string; cepText: string } | null
}

interface PerformanceRow {
  id: string
  postUrl: string
  views: number
  likes: number
  comments: number
  shares: number
  saves: number
  lastCheckedAt: string | null
  createdAt: string
  instagramAccount: { id: string; username: string }
  contentLog: { id: string; status: string; postUrl: string | null } | null
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function LogsPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const defaultTab = searchParams.get('tab') === 'performance' ? 'performance' : 'logs'

  const [activeTab, setActiveTab] = useState<'logs' | 'performance'>(defaultTab as 'logs' | 'performance')

  // Logs state
  const [logs, setLogs] = useState<ContentLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '')

  // Performance state
  const [perfRows, setPerfRows] = useState<PerformanceRow[]>([])
  const [loadingPerf, setLoadingPerf] = useState(false)
  const [perfLoaded, setPerfLoaded] = useState(false)

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/admin/content-logs?${params.toString()}`, { cache: 'no-store', credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setLogs(Array.isArray(data) ? data : data.logs ?? [])
    } catch {
      // silent
    } finally {
      setLoadingLogs(false)
    }
  }, [statusFilter])

  const fetchPerf = useCallback(async () => {
    if (perfLoaded) return
    setLoadingPerf(true)
    try {
      const res = await fetch('/api/admin/performance', { cache: 'no-store', credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setPerfRows(Array.isArray(data) ? data : data.trackers ?? data.rows ?? [])
      setPerfLoaded(true)
    } catch {
      // silent
    } finally {
      setLoadingPerf(false)
    }
  }, [perfLoaded])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  useEffect(() => {
    if (activeTab === 'performance') fetchPerf()
  }, [activeTab, fetchPerf])

  const switchTab = (tab: 'logs' | 'performance') => {
    setActiveTab(tab)
    router.replace(tab === 'performance' ? '/logs?tab=performance' : '/logs', { scroll: false })
  }

  const TABS = [
    { key: 'logs', label: 'Content Logs' },
    { key: 'performance', label: 'Performance' },
  ] as const

  const totalViews = perfRows.reduce((s, r) => s + r.views, 0)
  const totalLikes = perfRows.reduce((s, r) => s + r.likes, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeTab === 'logs'
              ? (loadingLogs ? '...' : `${logs.length} log entries`)
              : (loadingPerf ? '...' : `${perfRows.length} posts tracked`)}
          </p>
        </div>
        {activeTab === 'performance' && (
          <button onClick={() => { setPerfLoaded(false); fetchPerf() }} className="btn-info">Refresh</button>
        )}
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === key
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Content Logs ── */}
      {activeTab === 'logs' && (
        <>
          <PageInfo
            purpose="Riwayat semua konten yang dibuat dan diposting Hermes. Read-only — diisi otomatis oleh Hermes via API."
            wiring={[
              { label: '← Hermes Agent', desc: 'Hermes submit via POST /api/hermes/content-log' },
              { label: '← Character / Topic / CEP', desc: 'semua relasi dicatat untuk bisa lacak performa per CEP' },
              { label: '→ Performance Tracker', desc: 'tiap log posted otomatis buat PerformanceTracker record' },
              { label: '→ Posting Monitor', desc: 'status akun berubah ke MONITORING setelah log posted masuk' },
            ]}
          />

          {/* Filter bar */}
          <div className="flex flex-wrap gap-3 mb-5 bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide whitespace-nowrap">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">All</option>
                <option value="generated">Generated</option>
                <option value="posted">Posted</option>
                <option value="error">Error</option>
              </select>
            </div>
            <button onClick={fetchLogs} className="btn-info btn-sm">Apply</button>
            <button onClick={() => setStatusFilter('')} className="btn-ghost btn-sm">Clear</button>
          </div>

          {loadingLogs ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading logs...</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Date', 'Hermes', 'Account', 'Character', 'Topic', 'CEP', 'Status', 'Post URL', 'Prompt'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No content logs found.</td></tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{formatDate(log.postedAt ?? log.createdAt)}</td>
                        <td className="px-4 py-3 text-gray-700 font-medium">{log.hermesAgent.name}</td>
                        <td className="px-4 py-3 text-violet-700">@{log.instagramAccount.username}</td>
                        <td className="px-4 py-3 text-gray-600">{log.character?.name ?? <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-[120px]"><p className="truncate">{log.topic?.name ?? '—'}</p></td>
                        <td className="px-4 py-3 text-gray-500 max-w-[160px]">
                          <p className="truncate text-xs">{log.cep ? log.cep.cepText.substring(0, 60) + '…' : '—'}</p>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={log.status} /></td>
                        <td className="px-4 py-3">
                          {log.postUrl ? (
                            <a href={log.postUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">Open Post ↗</a>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <details className="group">
                            <summary className="text-xs text-violet-600 hover:underline cursor-pointer font-medium list-none">View Prompt</summary>
                            <div className="mt-2 max-w-sm">
                              <div className="bg-gray-900 text-gray-100 text-xs p-3 rounded-lg max-h-48 overflow-y-auto font-mono whitespace-pre-wrap">{log.prompt}</div>
                              {log.script && (
                                <div className="mt-2">
                                  <p className="text-xs font-medium text-gray-600 mb-1">Script:</p>
                                  <div className="bg-gray-50 text-gray-700 text-xs p-3 rounded-lg max-h-36 overflow-y-auto whitespace-pre-wrap border border-gray-200">{log.script}</div>
                                </div>
                              )}
                              {log.caption && (
                                <div className="mt-2">
                                  <p className="text-xs font-medium text-gray-600 mb-1">Caption:</p>
                                  <div className="bg-gray-50 text-gray-700 text-xs p-3 rounded-lg max-h-24 overflow-y-auto whitespace-pre-wrap border border-gray-200">{log.caption}</div>
                                </div>
                              )}
                            </div>
                          </details>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Tab 2: Performance ── */}
      {activeTab === 'performance' && (
        <>
          <PageInfo
            purpose="Metrik performa per post Instagram. Data ini dipakai cron untuk hitung growth/jam dan putuskan kapan akun READY_UPLOAD."
            wiring={[
              { label: '← Content Log', desc: "otomatis dibuat saat Hermes submit log dengan status 'posted'" },
              { label: '← Cron Job', desc: '/api/cron/fetch-metrics update metrik tiap jam' },
              { label: '→ Posting Monitor', desc: 'growth/jam dari sini menentukan status MONITORING/GROWING/HOT/READY' },
            ]}
          />

          {perfRows.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Posts', value: perfRows.length },
                { label: 'Total Views', value: totalViews },
                { label: 'Total Likes', value: totalLikes },
                { label: 'Avg Views/Post', value: perfRows.length ? Math.round(totalViews / perfRows.length) : 0 },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          )}

          {loadingPerf ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading performance data...</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Account', 'Post URL', 'Views', 'Likes', 'Comments', 'Shares', 'Saves', 'Growth/hr', 'Last Checked'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {perfRows.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No performance data yet.</td></tr>
                  ) : (
                    perfRows.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-violet-700">@{row.instagramAccount.username}</td>
                        <td className="px-4 py-3 max-w-[180px]">
                          <a href={row.postUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-600 hover:underline truncate block">{row.postUrl}</a>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{row.views.toLocaleString()}</td>
                        <td className="px-4 py-3 text-gray-700">{row.likes.toLocaleString()}</td>
                        <td className="px-4 py-3 text-gray-700">{row.comments.toLocaleString()}</td>
                        <td className="px-4 py-3 text-gray-700">{row.shares.toLocaleString()}</td>
                        <td className="px-4 py-3 text-gray-700">{row.saves.toLocaleString()}</td>
                        <td className="px-4 py-3"><span className="text-gray-400 text-xs">—</span></td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDate(row.lastCheckedAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
