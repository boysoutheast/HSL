'use client'

import { useEffect, useState, useCallback } from 'react'
import PageInfo from '@/components/ui/PageInfo'
import Modal from '@/components/ui/Modal'

interface AutomationRule {
  id: string
  name: string
  description: string | null
  status: string
  scope: string
  ruleCategory: string
  fireCount: number
  lastFiredAt: string | null
  campaignSession: { id: string; name: string } | null
  createdAt: string
}

interface CampaignSession {
  id: string
  name: string
}

interface RuleTemplate {
  id: string
  title: string
  description: string
  conditionSummary: string
  actionSummary: string
  scope: string
  ruleCategory: string
  conditionTreeJson: Record<string, unknown>
  actionSpecJson: Record<string, unknown>
  cooldownMinutes: number
  defaultThreshold?: number
  thresholdLabel?: string
}

const TEMPLATES: RuleTemplate[] = [
  {
    id: 'testing-kill-72h',
    title: 'Testing Kill – 72h No Leads',
    description: 'Kill a testing campaign if it has generated zero leads after 72 hours.',
    conditionSummary: 'CPC > threshold AND age > 72h AND leads = 0',
    actionSummary: 'Pause Campaign',
    scope: 'CAMPAIGN',
    ruleCategory: 'THRESHOLD',
    conditionTreeJson: {
      type: 'AND',
      conditions: [
        { metric: 'cpc', operator: '>', value: 0 },
        { metric: 'age_hours', operator: '>=', value: 72 },
        { metric: 'leads', operator: '=', value: 0 },
      ],
    },
    actionSpecJson: { type: 'PAUSE_CAMPAIGN' },
    cooldownMinutes: 60,
    defaultThreshold: 1.5,
    thresholdLabel: 'Max CPC (USD)',
  },
  {
    id: 'creative-cpc-failure',
    title: 'Creative CPC Failure',
    description: 'Pause a creative variant when its CPC exceeds the failure threshold during testing.',
    conditionSummary: 'CPC > threshold AND phase = TESTING',
    actionSummary: 'Pause Creative / Rotate',
    scope: 'AD',
    ruleCategory: 'THRESHOLD',
    conditionTreeJson: {
      type: 'AND',
      conditions: [
        { metric: 'cpc', operator: '>', value: 0 },
        { metric: 'phase', operator: '=', value: 'TESTING' },
      ],
    },
    actionSpecJson: { type: 'PAUSE_ADSET' },
    cooldownMinutes: 30,
    defaultThreshold: 2.0,
    thresholdLabel: 'Max CPC (USD)',
  },
  {
    id: 'roas-scaling',
    title: 'ROAS Scaling',
    description: 'Increase budget by 20% when ROAS exceeds the target threshold for 3 consecutive data points.',
    conditionSummary: 'ROAS > threshold × 3 consecutive checks',
    actionSummary: 'Increase Budget +20%',
    scope: 'CAMPAIGN',
    ruleCategory: 'THRESHOLD',
    conditionTreeJson: {
      type: 'AND',
      conditions: [
        { metric: 'roas', operator: '>', value: 0 },
        { metric: 'consecutive', operator: '>=', value: 3 },
      ],
    },
    actionSpecJson: { type: 'UPDATE_BUDGET', multiplier: 1.2 },
    cooldownMinutes: 240,
    defaultThreshold: 3.0,
    thresholdLabel: 'Min ROAS',
  },
  {
    id: 'night-pause',
    title: 'Night Pause (Schedule)',
    description: 'Automatically pause all active campaigns at night to conserve budget.',
    conditionSummary: 'Time is between 00:00 – 06:00 local',
    actionSummary: 'Pause Campaign',
    scope: 'CAMPAIGN',
    ruleCategory: 'SCHEDULE',
    conditionTreeJson: {
      type: 'SCHEDULE',
      schedule: { start: '00:00', end: '06:00', days: ['*'] },
    },
    actionSpecJson: { type: 'PAUSE_CAMPAIGN' },
    cooldownMinutes: 720,
  },
  {
    id: 'morning-resume',
    title: 'Morning Resume (Schedule)',
    description: 'Automatically resume all paused campaigns in the morning.',
    conditionSummary: 'Time is between 06:00 – 07:00 local',
    actionSummary: 'Resume Campaign',
    scope: 'CAMPAIGN',
    ruleCategory: 'SCHEDULE',
    conditionTreeJson: {
      type: 'SCHEDULE',
      schedule: { start: '06:00', end: '07:00', days: ['*'] },
    },
    actionSpecJson: { type: 'RESUME_CAMPAIGN' },
    cooldownMinutes: 720,
  },
  {
    id: 'creative-fatigue',
    title: 'Creative Fatigue',
    description: 'Detect when a creative is showing signs of fatigue (CTR dropping) and needs rotation.',
    conditionSummary: 'CTR drop > 30% over 7 days vs previous 7 days',
    actionSummary: 'Flag for Review / Replace Creative',
    scope: 'AD',
    ruleCategory: 'THRESHOLD',
    conditionTreeJson: {
      type: 'AND',
      conditions: [
        { metric: 'ctr_drop_pct', operator: '>', value: 30 },
        { metric: 'window_days', operator: '=', value: 7 },
      ],
    },
    actionSpecJson: { type: 'NOTIFY', channel: 'dashboard' },
    cooldownMinutes: 1440,
    defaultThreshold: 30,
    thresholdLabel: 'CTR Drop %',
  },
]

export default function RulesEditorPage() {
  const [tab, setTab] = useState<'my' | 'templates'>('my')
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [campaigns, setCampaigns] = useState<CampaignSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toggleLoading, setToggleLoading] = useState<string | null>(null)
  const [modalTemplate, setModalTemplate] = useState<RuleTemplate | null>(null)
  const [modalCampaign, setModalCampaign] = useState('')
  const [modalThreshold, setModalThreshold] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/automation-rules', { cache: 'no-store', credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setRules(data.rules ?? [])
    } catch {
      setError('Failed to load rules.')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/campaign-sessions', { cache: 'no-store', credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setCampaigns(data.sessions ?? [])
    } catch {}
  }, [])

  useEffect(() => {
    if (tab === 'my') {
      setLoading(true)
      fetchRules()
    } else {
      fetchCampaigns()
    }
  }, [tab, fetchRules, fetchCampaigns])

  const handleToggleStatus = async (rule: AutomationRule) => {
    setToggleLoading(rule.id)
    const newStatus = rule.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    try {
      const res = await fetch(`/api/admin/automation-rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed')
      await fetchRules()
      showToast(`Rule ${newStatus === 'ACTIVE' ? 'activated' : 'paused'}.`)
    } catch {
      showToast('Failed to update rule status.')
    } finally {
      setToggleLoading(null)
    }
  }

  const handleUseTemplate = (tpl: RuleTemplate) => {
    setModalTemplate(tpl)
    setModalCampaign('')
    setModalThreshold(tpl.defaultThreshold?.toString() ?? '')
  }

  const handleTemplateSubmit = async () => {
    if (!modalTemplate) return
    setSubmitting(true)
    try {
      const conditionTree = { ...modalTemplate.conditionTreeJson }
      // Inject threshold into condition if thresholdLabel exists
      if (modalTemplate.thresholdLabel && modalThreshold) {
        const threshKey = modalTemplate.thresholdLabel.toLowerCase().replace(/\s+\(/g, '_').replace(/\s/g, '_').replace(/[()]/g, '')
        // Update value in condition tree if metric matches
        if ('conditions' in conditionTree && Array.isArray(conditionTree.conditions)) {
          conditionTree.conditions = conditionTree.conditions.map((c: Record<string, unknown>) => {
            if (c.metric === threshKey || c.metric === 'cpc' || c.metric === 'roas') {
              return { ...c, value: parseFloat(modalThreshold) }
            }
            return c
          })
        }
      }

      const res = await fetch('/api/admin/automation-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: modalTemplate.title,
          description: modalTemplate.description,
          scope: modalTemplate.scope,
          ruleCategory: modalTemplate.ruleCategory,
          campaignSessionId: modalCampaign || undefined,
          conditionTreeJson: conditionTree,
          actionSpecJson: modalTemplate.actionSpecJson,
          cooldownMinutes: modalTemplate.cooldownMinutes,
        }),
      })
      if (!res.ok) throw new Error('Failed to create rule')
      await fetchRules()
      setModalTemplate(null)
      setTab('my')
      showToast('Rule created successfully.')
    } catch {
      showToast('Failed to create rule.')
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 bg-stone-800 text-white text-sm border border-stone-600 shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Rules Editor</h1>
          <p className="text-sm text-stone-500 mt-0.5">Create and manage automation rules for your campaigns.</p>
        </div>
        <button
          onClick={() => showToast('Advanced rule editor coming in v2')}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-violet-600 text-white border border-violet-700 hover:bg-violet-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Rule (Advanced)
        </button>
      </div>

      <PageInfo
        purpose="Automation rules evaluate campaign metrics on a schedule and execute actions like pausing, resuming, or scaling campaigns."
        inputs={[
          'Toggle rule status to ACTIVE or PAUSED',
          'Use a template to quickly create a rule for a specific campaign',
        ]}
        wiring={[
          { label: '→ Automation Actions', desc: 'Rules create actions in Action Center when they fire' },
          { label: '← Campaign Sessions', desc: 'Rules are attached to a campaign session for evaluation' },
          { label: '← Cron / Worker', desc: 'Rules are evaluated on a schedule by background workers' },
        ]}
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-stone-300 p-1 mb-6">
        {[
          { key: 'my', label: 'My Rules' },
          { key: 'templates', label: 'Templates' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key as 'my' | 'templates')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-violet-600 text-white'
                : 'text-stone-600 hover:bg-stone-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* My Rules Tab */}
      {tab === 'my' && (
        <>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
          )}
          {loading ? (
            <div className="flex items-center justify-center h-48 text-stone-400 text-sm">Loading rules...</div>
          ) : (
            <div className="border border-stone-300 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-stone-50">
                  <tr>
                    {['Name', 'Campaign', 'Category', 'Status', 'Fire Count', 'Last Fired', ''].map((h) => (
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
                  {rules.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-stone-400">
                        No rules yet. Use a template to create one.
                      </td>
                    </tr>
                  ) : (
                    rules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-stone-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-stone-800">
                          <div>{rule.name}</div>
                          {rule.description && (
                            <div className="text-xs text-stone-400 mt-0.5 max-w-[200px] truncate">{rule.description}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-stone-600 max-w-[150px] truncate">
                          {rule.campaignSession?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-stone-100 text-stone-600 border border-stone-300">
                            {rule.ruleCategory}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleStatus(rule)}
                            disabled={toggleLoading === rule.id}
                            className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border transition-colors ${
                              rule.status === 'ACTIVE'
                                ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
                                : rule.status === 'PAUSED'
                                ? 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200'
                                : 'bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200'
                            }`}
                          >
                            {toggleLoading === rule.id ? '...' : rule.status}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-stone-500">
                          {rule.fireCount}
                        </td>
                        <td className="px-4 py-3 text-stone-500 whitespace-nowrap">
                          {formatDate(rule.lastFiredAt)}
                        </td>
                        <td className="px-4 py-3 text-stone-400 text-xs">
                          {rule.scope}
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

      {/* Templates Tab */}
      {tab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TEMPLATES.map((tpl) => (
            <div
              key={tpl.id}
              className="border border-stone-300 bg-white p-5 flex flex-col gap-3"
            >
              <div>
                <h3 className="font-semibold text-stone-900 text-sm">{tpl.title}</h3>
                <p className="text-xs text-stone-500 mt-1">{tpl.description}</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-semibold text-violet-600 whitespace-nowrap">When:</span>
                  <span className="text-xs text-stone-600">{tpl.conditionSummary}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-xs font-semibold text-orange-600 whitespace-nowrap">Then:</span>
                  <span className="text-xs text-stone-600">{tpl.actionSummary}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-stone-500 whitespace-nowrap">Scope:</span>
                  <span className="text-xs text-stone-500">{tpl.scope}</span>
                </div>
              </div>
              <button
                onClick={() => handleUseTemplate(tpl)}
                className="mt-auto flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-violet-600 text-white hover:bg-violet-700 transition-colors border border-violet-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Use Template
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Use Template Modal */}
      <Modal
        open={modalTemplate !== null}
        onClose={() => setModalTemplate(null)}
        title={modalTemplate ? `Use Template: ${modalTemplate.title}` : ''}
      >
        {modalTemplate && (
          <div className="space-y-4">
            <p className="text-sm text-stone-600">{modalTemplate.description}</p>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Campaign</label>
              <select
                value={modalCampaign}
                onChange={(e) => setModalCampaign(e.target.value)}
                className="w-full border border-stone-300 px-3 py-2 text-sm bg-white focus:outline-none focus:border-violet-500"
              >
                <option value="">All Campaigns</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {modalTemplate.thresholdLabel && (
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  {modalTemplate.thresholdLabel}
                </label>
                <input
                  type="number"
                  value={modalThreshold}
                  onChange={(e) => setModalThreshold(e.target.value)}
                  placeholder={modalTemplate.defaultThreshold?.toString()}
                  className="w-full border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setModalTemplate(null)}
                className="px-4 py-2 text-sm border border-stone-300 hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTemplateSubmit}
                disabled={submitting}
                className="px-4 py-2 text-sm bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Rule'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
