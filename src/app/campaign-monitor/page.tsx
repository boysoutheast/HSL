'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Table from '@/components/ui/Table'
import PageInfo from '@/components/ui/PageInfo'
import { HelpHint } from '@/components/ui/HelpHint'
import { startTour, hasSeenTour } from '@/lib/useTour'
import { CAMPAIGN_TOUR } from '@/lib/tours'

interface CampaignSession {
  id: string
  name: string
  status: string
  phase: string
  source: string
  importStatus: string | null
  automationEnabled: boolean
  dailyBudget: string
  monitorIntervalMinutes: number
  lastMonitorAt: string | null
  _count: { automationRules: number }
  product: { id: string; name: string } | null
  metaAdAccount: { id: string; adAccountId: string; accountName: string | null } | null
  latestMetric: {
    spend: number
    leads: number
    purchases: number
    roas: number | null
    cpc: number | null
    lastSyncedAt: string
  } | null
  createdAt: string
}

const STATUS_COLORS: Record<string, string> = {
  RUNNING: 'bg-green-100 text-green-800',
  PAUSED: 'bg-yellow-100 text-yellow-800',
  KILLED: 'bg-red-100 text-red-800',
  COMPLETED: 'bg-stone-100 text-stone-600',
  ERROR: 'bg-red-100 text-red-800',
  DRAFT: 'bg-stone-100 text-stone-600',
  QUEUED: 'bg-blue-100 text-blue-800',
  CREATING: 'bg-violet-100 text-violet-800',
  APPROVAL_REQUIRED: 'bg-yellow-100 text-yellow-800',
}

const PHASE_COLORS: Record<string, string> = {
  TESTING: 'bg-blue-100 text-blue-800',
  SCALING: 'bg-violet-100 text-violet-800',
  MAINTENANCE: 'bg-stone-100 text-stone-600',
  EXITED: 'bg-red-100 text-red-800',
}

const SOURCE_BADGES: Record<string, { label: string; cls: string }> = {
  launch: { label: '🚀 Launch', cls: 'bg-violet-100 text-violet-800' },
  imported: { label: '🔵 Imported', cls: 'bg-blue-100 text-blue-800' },
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-stone-100 text-stone-600'
  return <span className={`text-xs px-2 py-1 rounded-full font-medium ${cls}`}>{status}</span>
}

function PhaseBadge({ phase }: { phase: string }) {
  const cls = PHASE_COLORS[phase] ?? 'bg-stone-100 text-stone-600'
  return <span className={`text-xs px-2 py-1 rounded-full font-medium ${cls}`}>{phase}</span>
}

function SourceBadge({ source }: { source: string }) {
  const def = SOURCE_BADGES[source] ?? { label: source, cls: 'bg-stone-100 text-stone-600' }
  return <span className={`text-xs px-2 py-1 rounded-full font-medium ${def.cls}`}>{def.label}</span>
}

function AutoToggle({
  enabled,
  sessionId,
  onToggle,
}: {
  enabled: boolean
  sessionId: string
  onToggle: (id: string, newVal: boolean) => void
}) {
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/campaign-sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ automationEnabled: !enabled }),
      })
      if (res.ok) {
        onToggle(sessionId, !enabled)
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? 'Failed to toggle automation')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); handleToggle() }}
      disabled={loading}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 ${
        enabled ? 'bg-violet-600' : 'bg-stone-300'
      }`}
      title={enabled ? 'Automation ON' : 'Automation OFF'}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
          enabled ? 'translate-x-4' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

export default function CampaignMonitorPage() {
  const [sessions, setSessions] = useState<CampaignSession[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [phaseFilter, setPhaseFilter] = useState<string>('')
  const [refreshing, setRefreshing] = useState(false)

  const fetchSessions = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (phaseFilter) params.set('phase', phaseFilter)
      const res = await fetch(`/api/admin/campaign-sessions?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSessions(data.sessions ?? [])
    } catch {
      /* silent */
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [statusFilter, phaseFilter])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  // Auto-start tour sekali
  useEffect(() => {
    if (!loading && sessions.length > 0 && !hasSeenTour(CAMPAIGN_TOUR)) {
      const t = setTimeout(() => startTour(CAMPAIGN_TOUR), 800)
      return () => clearTimeout(t)
    }
  }, [loading, sessions.length])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchSessions()
  }

  const handleToggle = (id: string, newVal: boolean) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, automationEnabled: newVal } : s))
    )
  }

  const fmtCurrency = (n: number | null | undefined) =>
    n != null ? `Rp ${Number(n).toLocaleString('id-ID', { maximumFractionDigits: 0 })}` : '—'

  const fmtDate = (d: string | null) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const fmtTimeAgo = (d: string | null) => {
    if (!d) return ''
    const diff = Date.now() - new Date(d).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Campaign Monitor</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {loading ? '...' : `${sessions.length} campaign${sessions.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => startTour(CAMPAIGN_TOUR, { force: true })}
            className="btn-ghost flex items-center gap-1.5 text-xs"
            title="Mulai tur panduan"
          >🧑‍🏫 Tour</button>
          <Link href="/ads?tab=campaigns&new=1" className="btn-ghost flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Launch <HelpHint k="cm.newLaunch" />
          </Link>
          <Link href="/campaign-monitor/import" data-tour="cm-import" className="btn-primary flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
            + Import Campaign
          </Link>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-ghost flex items-center gap-1.5"
          >
            <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh <HelpHint k="cm.refresh" />
          </button>
        </div>
      </div>

      <PageInfo
        purpose="Monitor all Meta Ads campaign sessions. Toggle automation on/off, track spend, leads, and purchases per campaign."
        wiring={[
          { label: '→ Test Launches', desc: 'campaigns are launched from test launches' },
          { label: '→ Import Campaign', desc: 'bring existing Meta campaigns under AI Buddy management' },
          { label: '→ Automation Rules', desc: 'each campaign can have rules for automated actions' },
          { label: '→ Meta Structure', desc: 'campaign → adset → ad hierarchy visible per campaign' },
        ]}
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-stone-600 font-medium">Status: <HelpHint k="cm.statusFilter" /></label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-stone-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">All</option>
            <option value="RUNNING">RUNNING</option>
            <option value="PAUSED">PAUSED</option>
            <option value="KILLED">KILLED</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="ERROR">ERROR</option>
            <option value="DRAFT">DRAFT</option>
            <option value="QUEUED">QUEUED</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-stone-600 font-medium">Phase: <HelpHint k="cm.phaseFilter" /></label>
          <select
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.target.value)}
            className="border border-stone-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">All</option>
            <option value="TESTING">TESTING</option>
            <option value="SCALING">SCALING</option>
            <option value="MAINTENANCE">MAINTENANCE</option>
            <option value="EXITED">EXITED</option>
          </select>
        </div>
        <div className="flex items-center gap-1 text-xs text-stone-500">
          Auto: <HelpHint k="cm.autoToggle" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-stone-400 text-sm">Loading...</div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-stone-400 text-sm gap-2">
          <svg className="w-12 h-12 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>No campaigns yet. Launch one from Test Launches or import an existing campaign.</p>
          <Link href="/campaign-monitor/import" className="btn-primary btn-sm">+ Import Campaign</Link>
        </div>
      ) : (
        <Table
          headers={['Campaign', 'Product', 'Phase', 'Status', 'Source', 'Budget', 'Spend', 'Leads', 'Purchases', 'CPC', 'ROAS', 'Auto', 'Rules', 'Scan']}
          empty="No campaigns match the selected filters."
        >
          {sessions.map((session, i) => (
            <tr
              key={session.id}
              className="hover:bg-stone-50 transition-colors cursor-pointer"
              onClick={() => { window.location.href = `/campaign-monitor/${session.id}` }}
            >
              <td className="px-4 py-3">
                <p className="font-medium text-stone-900">{session.name}</p>
                {session.metaAdAccount && (
                  <p className="text-xs text-stone-400 mt-0.5">
                    {session.metaAdAccount.accountName ?? session.metaAdAccount.adAccountId}
                  </p>
                )}
                {/* Setup status badge */}
                {(!session.automationEnabled || (session._count?.automationRules ?? 0) === 0) && (
                  <p className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded mt-1 inline-block font-medium">
                    ⚠️ Setup belum selesai
                  </p>
                )}
              </td>
              <td className="px-4 py-3 text-stone-600 text-sm">
                {session.product?.name ?? '—'}
              </td>
              <td className="px-4 py-3">
                <PhaseBadge phase={session.phase} />
                {session.importStatus && (
                  <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    session.importStatus==='synced' ? 'bg-green-100 text-green-700'
                    : session.importStatus==='sync_failed' ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {session.importStatus==='synced' ? 'Synced' : session.importStatus==='sync_failed' ? 'Gagal' : 'Syncing'}
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={session.status} />
              </td>
              <td className="px-4 py-3">
                <SourceBadge source={session.source} />
              </td>
              <td className="px-4 py-3 text-stone-600 whitespace-nowrap">
                {fmtCurrency(Number(session.dailyBudget))}
              </td>
              <td className="px-4 py-3 text-stone-600 whitespace-nowrap">
                {fmtCurrency(session.latestMetric?.spend)}
              </td>
              <td className="px-4 py-3 text-stone-600 text-center">
                {session.latestMetric?.leads ?? '—'}
              </td>
              <td className="px-4 py-3 text-stone-600 text-center">
                {session.latestMetric?.purchases ?? '—'}
              </td>
              <td className="px-4 py-3 text-stone-600 whitespace-nowrap">
                {session.latestMetric?.cpc != null
                  ? `Rp ${Number(session.latestMetric.cpc).toLocaleString('id-ID', { maximumFractionDigits: 0 })}`
                  : '—'}
              </td>
              <td className="px-4 py-3 text-stone-600 whitespace-nowrap">
                {session.latestMetric?.roas != null ? `${Number(session.latestMetric.roas).toFixed(2)}x` : '—'}
              </td>
              <td className="px-4 py-3">
                <div onClick={(e) => e.stopPropagation()} data-tour={i === 0 ? "cm-auto" : undefined}>
                  <AutoToggle
                    enabled={session.automationEnabled}
                    sessionId={session.id}
                    onToggle={handleToggle}
                  />
                </div>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  (session._count?.automationRules ?? 0) > 0
                    ? 'bg-violet-100 text-violet-700'
                    : 'bg-stone-100 text-stone-400'
                }`}>
                  {(session._count?.automationRules ?? 0)} rules
                </span>
              </td>
              <td className="px-4 py-3 text-stone-500 text-xs whitespace-nowrap">
                <span className="text-stone-400">⏱</span> tiap {session.monitorIntervalMinutes}m
                {session.lastMonitorAt && (
                  <span className="block text-stone-400">🔄 {fmtTimeAgo(session.lastMonitorAt)}</span>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
