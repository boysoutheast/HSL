'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface Session {
  id: string
  name: string
  status: string
  phase: string
  automationEnabled: boolean
  dailyBudget: string
  currency: string
  objective: string
  monitorIntervalMinutes: number
  lastMonitorAt: string | null
  nextMonitorAt: string | null
  lastActionAt: string | null
  product: { id: string; name: string } | null
  metaAdAccount: { id: string; adAccountId: string; accountName: string | null } | null
  metaEntities: MetaEntity[]
  latestSnapshot: MetricSnapshot | null
  automationRulesCount: number
}

interface MetaEntity {
  id: string
  entityType: string
  metaEntityId: string
  name: string
  effectiveStatus: string | null
  configuredStatus: string | null
  lastSyncedAt: string
  parentMetaEntityId: string | null
}

interface MetricSnapshot {
  spend: number
  leads: number
  purchases: number
  roas: number | null
  cpc: number | null
  impressions: number
  clicks: number
  windowEnd: string
}

interface AutomationAction {
  id: string
  source: string
  actionType: string
  status: string
  requestedAt: string
  executedAt: string | null
  targetMetaEntityId: string | null
}

interface AutomationRule {
  id: string
  name: string
  description: string | null
  status: string
  ruleCategory: string
  scope: string
  conditionTreeJson: string
  actionSpecJson: string
  sourceTemplateId: string | null
  lastFiredAt: string | null
  fireCount: number
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

const ACTION_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  SUCCEEDED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  UNCERTAIN: 'bg-orange-100 text-orange-800',
  CANCELLED: 'bg-stone-100 text-stone-600',
}

const SOURCE_COLORS: Record<string, string> = {
  USER: 'bg-stone-200 text-stone-700',
  RULE: 'bg-violet-100 text-violet-800',
  SCHEDULE: 'bg-blue-100 text-blue-800',
  SYSTEM: 'bg-red-100 text-red-800',
}

const ENTITY_TYPE_COLORS: Record<string, string> = {
  CAMPAIGN: 'bg-violet-100 text-violet-800',
  ADSET: 'bg-blue-100 text-blue-800',
  AD: 'bg-green-100 text-green-800',
  CREATIVE: 'bg-orange-100 text-orange-800',
}

type Tab = 'overview' | 'meta' | 'actions' | 'rules' | 'audit' | 'topup'

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-stone-100 text-stone-600'
  return <span className={`text-xs px-2 py-1 rounded-full font-medium ${cls}`}>{status}</span>
}

function PhaseBadge({ phase }: { phase: string }) {
  const cls = PHASE_COLORS[phase] ?? 'bg-stone-100 text-stone-600'
  return <span className={`text-xs px-2 py-1 rounded-full font-medium ${cls}`}>{phase}</span>
}

function ActionStatusBadge({ status }: { status: string }) {
  const cls = ACTION_STATUS_COLORS[status] ?? 'bg-stone-100 text-stone-600'
  return <span className={`text-xs px-2 py-1 rounded-full font-medium ${cls}`}>{status}</span>
}

function SourceBadge({ source }: { source: string }) {
  const cls = SOURCE_COLORS[source] ?? 'bg-stone-100 text-stone-600'
  return <span className={`text-xs px-2 py-1 rounded-full font-medium ${cls}`}>{source}</span>
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded border border-stone-300 px-4 py-3">
      <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-stone-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function fmtCurrency(n: number | null | undefined, currency = 'IDR') {
  if (n == null) return '—'
  return `${currency} ${Number(n).toLocaleString('id-ID', { maximumFractionDigits: 0 })}`
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function fmtDateOrNever(d: string | null) {
  if (!d) return 'Never'
  return fmtDate(d)
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [actions, setActions] = useState<AutomationAction[]>([])
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [togglingAuto, setTogglingAuto] = useState(false)

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/campaign-sessions/${id}`, { credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const loaded = data.session as Session
      setSession(loaded)
      // If latestSnapshot is not loaded, fetch from metrics endpoint
      if (!loaded.latestSnapshot) {
        try {
          const metricsRes = await fetch(`/api/admin/campaign-sessions/${id}/metrics`, { credentials: 'include' })
          if (metricsRes.ok) {
            const metricsData = await metricsRes.json()
            const metrics = metricsData.metrics as MetricSnapshot[] | undefined
            if (metrics && metrics.length > 0) {
              setSession((prev) => prev ? { ...prev, latestSnapshot: metrics[0] } : prev)
            }
          }
        } catch { /* silent */ }
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchActions = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/campaign-sessions/${id}/actions`, { credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setActions(data.actions ?? [])
    } catch { /* silent */ }
  }, [id])

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/campaign-sessions/${id}/rules`, { credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setRules(data.rules ?? [])
    } catch { /* silent */ }
  }, [id])

  useEffect(() => { fetchSession() }, [fetchSession])

  useEffect(() => {
    if (activeTab === 'actions') fetchActions()
    if (activeTab === 'rules') fetchRules()
  }, [activeTab, fetchActions, fetchRules])

  const handleAutoToggle = async () => {
    if (!session) return
    setTogglingAuto(true)
    try {
      const res = await fetch(`/api/admin/campaign-sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ automationEnabled: !session.automationEnabled }),
      })
      if (res.ok) {
        setSession({ ...session, automationEnabled: !session.automationEnabled })
      }
    } finally {
      setTogglingAuto(false)
    }
  }

  const handleRuleToggle = async (ruleId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    try {
      const res = await fetch(`/api/admin/automation-rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setRules((prev) =>
          prev.map((r) => (r.id === ruleId ? { ...r, status: newStatus } : r))
        )
      }
    } catch { /* silent */ }
  }

  const handleDetachRule = async (ruleId: string) => {
    const confirmed = window.confirm('Detach this rule? It will be archived (history preserved).')
    if (!confirmed) return
    try {
      const res = await fetch(`/api/admin/campaign-sessions/${id}/rules?ruleId=${ruleId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== ruleId))
      }
    } catch { /* silent */ }
  }

  // Simple rule condition↔action parser for UI (client-side, no lib import needed)
  const ruleSummary = (rule: AutomationRule): string => {
    try {
      const cond = JSON.parse(rule.conditionTreeJson)
      const act = JSON.parse(rule.actionSpecJson)
      const parts: string[] = []
      if (cond.conditions) {
        for (const c of cond.conditions) {
          parts.push(`${c.metric} ${c.operator} ${c.value}`)
        }
      }
      const condStr = cond.operator ? parts.join(` ${cond.operator} `) : parts.join(', ')
      let actStr = act.action ?? ''
      if (act.params?.percentage) actStr += ` ${act.params.percentage > 0 ? '+' : ''}${act.params.percentage}%`
      if (act.params?.fixedAmount) actStr += ` → Rp ${Number(act.params.fixedAmount).toLocaleString('id-ID')}`
      return `IF ${condStr || '?'} → ${actStr || '?'}`
    } catch {
      return rule.name
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-stone-400 text-sm">Loading...</div>
    )
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-stone-400 text-sm gap-2">
        <p>Campaign not found.</p>
        <Link href="/ads?tab=monitor" className="btn-ghost btn-sm">← Back</Link>
      </div>
    )
  }

  const snap = session.latestSnapshot
  const todaySpend = snap?.spend ?? 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/ads?tab=monitor" className="text-stone-400 hover:text-stone-600 text-sm">← Campaign Monitor</Link>
          <div>
            <h1 className="text-2xl font-bold text-stone-900">{session.name}</h1>
            <p className="text-sm text-stone-500 mt-0.5">
              {session.product?.name ?? 'No product'} &bull; {session.metaAdAccount?.accountName ?? session.metaAdAccount?.adAccountId ?? 'No ad account'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-stone-300 mb-6">
        {(['overview', 'meta', 'actions', 'rules', 'audit', 'topup'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'text-violet-700 border-violet-700'
                : 'text-stone-500 border-transparent hover:text-stone-700'
            }`}
          >
            {tab === 'meta' ? 'Meta Structure' : tab}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
              label="Daily Budget"
              value={fmtCurrency(Number(session.dailyBudget), session.currency)}
            />
            <StatCard
              label="Today Spend"
              value={fmtCurrency(todaySpend, session.currency)}
            />
            <StatCard
              label="Purchases"
              value={snap?.purchases?.toString() ?? '—'}
            />
            <StatCard
              label="ROAS"
              value={snap?.roas != null ? `${Number(snap.roas).toFixed(2)}x` : '—'}
            />
            <StatCard
              label="CPC"
              value={snap?.cpc != null ? fmtCurrency(snap.cpc, session.currency) : '—'}
            />
            <StatCard
              label="Phase"
              value={session.phase}
              sub={PHASE_COLORS[session.phase] ? '' : undefined}
            />
          </div>

          {/* Status + automation */}
          <div className="bg-white rounded border border-stone-300 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs text-stone-500 font-medium uppercase tracking-wide mb-1">Status</p>
                <StatusBadge status={session.status} />
              </div>
              <div>
                <p className="text-xs text-stone-500 font-medium uppercase tracking-wide mb-1">Automation</p>
                <button
                  onClick={handleAutoToggle}
                  disabled={togglingAuto}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 ${
                    session.automationEnabled ? 'bg-violet-600' : 'bg-stone-300'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                      session.automationEnabled ? 'translate-x-4' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div>
                <p className="text-xs text-stone-500 font-medium uppercase tracking-wide mb-1">Objective</p>
                <p className="text-sm font-medium text-stone-700">{session.objective}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-stone-500 font-medium uppercase tracking-wide mb-1">Monitor</p>
              <p className="text-sm text-stone-700">Last: {fmtDateOrNever(session.lastMonitorAt)}</p>
              <p className="text-xs text-stone-400">Next: {fmtDateOrNever(session.nextMonitorAt)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── META STRUCTURE ── */}
      {activeTab === 'meta' && (
        <div className="space-y-4">
          {session.metaEntities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-stone-400 text-sm gap-2">
              <p>No Meta entities synced yet.</p>
            </div>
          ) : (
            <>
              {/* Build tree: Campaign → AdSets → Ads */}
              {['CAMPAIGN', 'ADSET', 'AD'].map((entityType) => {
                const entities = session.metaEntities.filter((e) => e.entityType === entityType)
                if (entities.length === 0) return null
                return (
                  <div key={entityType}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${ENTITY_TYPE_COLORS[entityType] ?? 'bg-stone-100 text-stone-600'}`}>
                        {entityType}
                      </span>
                      <span className="text-xs text-stone-500">{entities.length} {entityType.toLowerCase()}{entities.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="space-y-1">
                      {entities.map((entity) => (
                        <div
                          key={entity.id}
                          className="flex items-center gap-3 bg-white rounded border border-stone-200 px-4 py-2.5 hover:border-violet-300 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-stone-800 truncate">{entity.name}</p>
                              {entity.effectiveStatus && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  ['ACTIVE','RUNNING','PAUSED'].includes(entity.effectiveStatus)
                                    ? 'bg-green-100 text-green-700'
                                    : entity.effectiveStatus === 'DISABLED'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-stone-100 text-stone-600'
                                }`}>
                                  {entity.effectiveStatus}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-stone-400 mt-0.5">
                              ID: {entity.metaEntityId}
                              {entity.configuredStatus && entity.configuredStatus !== entity.effectiveStatus
                                ? ` | Configured: ${entity.configuredStatus}`
                                : ''}
                            </p>
                          </div>
                          <p className="text-xs text-stone-400 whitespace-nowrap">
                            Synced {fmtDate(entity.lastSyncedAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}

      {/* ── ACTIONS ── */}
      {activeTab === 'actions' && (
        <div>
          {actions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-stone-400 text-sm gap-2">
              <p>No automation actions yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded border border-stone-300 bg-white">
              <table className="min-w-full divide-y divide-stone-200 text-sm">
                <thead className="bg-stone-50">
                  <tr>
                    {['Source', 'Action Type', 'Target', 'Status', 'Requested', 'Executed'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {actions.map((action) => (
                    <tr key={action.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-3"><SourceBadge source={action.source} /></td>
                      <td className="px-4 py-3 text-stone-700 font-medium whitespace-nowrap">{action.actionType}</td>
                      <td className="px-4 py-3 text-stone-500 text-xs font-mono">{action.targetMetaEntityId ?? '—'}</td>
                      <td className="px-4 py-3"><ActionStatusBadge status={action.status} /></td>
                      <td className="px-4 py-3 text-stone-500 whitespace-nowrap">{fmtDate(action.requestedAt)}</td>
                      <td className="px-4 py-3 text-stone-500 whitespace-nowrap">{fmtDate(action.executedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── RULES ── */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-stone-500">{rules.length} rule{rules.length !== 1 ? 's' : ''}</p>
            <Link href={`/campaign-monitor/${id}/rules/new`} className="btn-primary btn-sm">
              + Attach Template
            </Link>
          </div>
          {rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-stone-400 text-sm gap-2">
              <p>No automation rules yet.</p>
              <Link href={`/campaign-monitor/${id}/rules/new`} className="btn-ghost btn-sm">+ Attach a rule template</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <div key={rule.id} className="bg-white rounded border border-stone-200 px-4 py-3 hover:border-violet-300 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-stone-800">{rule.name}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          rule.status === 'ACTIVE' ? 'bg-green-100 text-green-700'
                          : rule.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-stone-100 text-stone-600'
                        }`}>
                          {rule.status}
                        </span>
                      </div>
                      {/* Human-readable condition→action */}
                      <p className="text-xs font-mono text-stone-600 mt-1.5 bg-stone-50 rounded px-2 py-1">
                        {ruleSummary(rule)}
                      </p>
                      <p className="text-xs text-stone-400 mt-1">
                        {rule.ruleCategory} &bull; {rule.scope} &bull; Fired {rule.fireCount}x
                        {rule.lastFiredAt && ` • Last ${fmtDate(rule.lastFiredAt)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleRuleToggle(rule.id, rule.status)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 ${
                          rule.status === 'ACTIVE' ? 'bg-violet-600' : 'bg-stone-300'
                        }`}
                        title={rule.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                            rule.status === 'ACTIVE' ? 'translate-x-4' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <button
                        onClick={() => handleDetachRule(rule.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                        title="Detach rule"
                      >
                        Detach
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── AUDIT ── */}
      {activeTab === 'audit' && (
        <div className="flex flex-col items-center justify-center h-64 text-stone-400 text-sm gap-2">
          <svg className="w-12 h-12 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>Audit log coming soon</p>
        </div>
      )}

      {/* ── TOP-UP ── */}
      {activeTab === 'topup' && <TopUpTab sessionId={id} />}
    </div>
  )
}
