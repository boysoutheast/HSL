'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeafCondition {
  kind: 'leaf'
  metric: string
  operator: string
  value: string
}

interface GroupCondition {
  kind: 'group'
  type: 'AND' | 'OR'
  children: LeafCondition[]
}

type BuilderCondition = LeafCondition | GroupCondition

interface BuilderAction {
  type: string
  // UPDATE_BUDGET
  multiplier?: string
  // RENAME_ENTITY
  renameMode?: 'append' | 'remove'
  renameTag?: string
  // NOTIFY
  message?: string
}

interface CampaignSession {
  id: string
  name: string
}

interface DryRunResult {
  evaluated: number
  matched: number
  withoutMetrics: number
  results: Array<{
    entityId: string
    entityName: string
    matched: boolean
    hasMetrics: boolean
    details: Array<{ metric: string; operator: string; expected: unknown; actual: unknown; matched: boolean; note?: string }>
  }>
}

// ── Constants ─────────────────────────────────────────────────────────────────

const METRICS = [
  { value: 'spend', label: 'Spend' },
  { value: 'impressions', label: 'Impressions' },
  { value: 'clicks', label: 'Clicks' },
  { value: 'cpc', label: 'CPC' },
  { value: 'ctr', label: 'CTR (%)' },
  { value: 'cpm', label: 'CPM' },
  { value: 'leads', label: 'Leads' },
  { value: 'purchases', label: 'Purchases' },
  { value: 'roas', label: 'ROAS' },
  { value: 'frequency', label: 'Frequency' },
  { value: 'age_hours', label: 'Entity Age (hours)' },
  { value: 'phase', label: 'Phase (TESTING/SCALING)' },
  { value: 'consecutive', label: 'Consecutive checks' },
]

const OPERATORS = [
  { value: '>', label: '>' },
  { value: '>=', label: '≥' },
  { value: '<', label: '<' },
  { value: '<=', label: '≤' },
  { value: '=', label: '=' },
  { value: '!=', label: '≠' },
]

const ACTION_TYPES = [
  { value: 'PAUSE_CAMPAIGN', label: '⏸ Pause Campaign', scopes: ['CAMPAIGN'] },
  { value: 'RESUME_CAMPAIGN', label: '▶️ Resume Campaign', scopes: ['CAMPAIGN'] },
  { value: 'PAUSE_ADSET', label: '⏸ Pause Ad Set', scopes: ['ADSET', 'AD'] },
  { value: 'RESUME_ADSET', label: '▶️ Resume Ad Set', scopes: ['ADSET', 'AD'] },
  { value: 'UPDATE_BUDGET', label: '💰 Update Budget', scopes: ['CAMPAIGN', 'ADSET'] },
  { value: 'RENAME_ENTITY', label: '🏷 Rename / Tag', scopes: ['CAMPAIGN', 'ADSET', 'AD'] },
  { value: 'NOTIFY', label: '🔔 Notify', scopes: ['CAMPAIGN', 'ADSET', 'AD'] },
]

const SCOPES = ['CAMPAIGN', 'ADSET', 'AD'] as const

const inputCls = 'border border-stone-200 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500'

// ── Serialization ─────────────────────────────────────────────────────────────

function buildConditionTree(rootType: 'AND' | 'OR', conditions: BuilderCondition[]) {
  return {
    type: rootType,
    conditions: conditions.map(c => {
      if (c.kind === 'group') {
        return {
          type: c.type,
          conditions: c.children.map(l => ({
            metric: l.metric,
            operator: l.operator,
            value: isNaN(Number(l.value)) ? l.value : Number(l.value),
          })),
        }
      }
      return {
        metric: c.metric,
        operator: c.operator,
        value: isNaN(Number(c.value)) ? c.value : Number(c.value),
      }
    }),
  }
}

function buildActionSpec(actions: BuilderAction[]) {
  const specs = actions.map(a => {
    const spec: Record<string, unknown> = { type: a.type }
    if (a.type === 'UPDATE_BUDGET' && a.multiplier) spec.multiplier = Number(a.multiplier)
    if (a.type === 'RENAME_ENTITY') {
      spec.mode = a.renameMode ?? 'append'
      spec.tag = a.renameTag ?? ''
    }
    if (a.type === 'NOTIFY' && a.message) spec.message = a.message
    return spec
  })
  return specs.length === 1 ? specs[0] : { type: 'MULTI', actions: specs }
}

const newLeaf = (): LeafCondition => ({ kind: 'leaf', metric: 'spend', operator: '>', value: '' })
const newAction = (): BuilderAction => ({ type: 'PAUSE_CAMPAIGN', renameMode: 'append' })

// ── Components ────────────────────────────────────────────────────────────────

function ConditionRow({
  cond,
  onChange,
  onRemove,
}: {
  cond: LeafCondition
  onChange: (c: LeafCondition) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-stone-300 dark:text-stone-600 cursor-grab select-none">⠿</span>
      <select
        value={cond.metric}
        onChange={e => onChange({ ...cond, metric: e.target.value })}
        className={`${inputCls} flex-1 min-w-0`}
      >
        {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
      <select
        value={cond.operator}
        onChange={e => onChange({ ...cond, operator: e.target.value })}
        className={`${inputCls} w-16 text-center`}
      >
        {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <input
        type="text"
        value={cond.value}
        onChange={e => onChange({ ...cond, value: e.target.value })}
        placeholder="value"
        className={`${inputCls} w-28`}
      />
      <button
        type="button"
        onClick={onRemove}
        className="p-1.5 text-stone-300 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
        title="Remove condition"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
      </button>
    </div>
  )
}

function ActionCard({
  action,
  scope,
  onChange,
  onRemove,
  canRemove,
}: {
  action: BuilderAction
  scope: string
  onChange: (a: BuilderAction) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const available = ACTION_TYPES.filter(a => a.scopes.includes(scope))
  return (
    <div className="p-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/40 space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={action.type}
          onChange={e => onChange({ ...action, type: e.target.value })}
          className={`${inputCls} flex-1`}
        >
          {available.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-stone-300 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
            title="Remove action"
          >
            ✕
          </button>
        )}
      </div>

      {action.type === 'UPDATE_BUDGET' && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-stone-500">Budget ×</span>
          <input
            type="number"
            step="0.1"
            value={action.multiplier ?? ''}
            onChange={e => onChange({ ...action, multiplier: e.target.value })}
            placeholder="1.2"
            className={`${inputCls} w-24`}
          />
          <span className="text-xs text-stone-400">(1.2 = +20%, 0.8 = −20%)</span>
        </div>
      )}

      {action.type === 'RENAME_ENTITY' && (
        <div className="flex items-center gap-2 text-sm">
          <select
            value={action.renameMode ?? 'append'}
            onChange={e => onChange({ ...action, renameMode: e.target.value as 'append' | 'remove' })}
            className={`${inputCls} w-44`}
          >
            <option value="append">Add to name</option>
            <option value="remove">Remove from name</option>
          </select>
          <input
            type="text"
            value={action.renameTag ?? ''}
            onChange={e => onChange({ ...action, renameTag: e.target.value })}
            placeholder=":StopLoss"
            className={`${inputCls} flex-1`}
          />
        </div>
      )}

      {action.type === 'NOTIFY' && (
        <input
          type="text"
          value={action.message ?? ''}
          onChange={e => onChange({ ...action, message: e.target.value })}
          placeholder="Pesan notifikasi (mis. Rule Stop Loss kena di {entity})"
          className={`${inputCls} w-full`}
        />
      )}
    </div>
  )
}

// ── Main Builder ──────────────────────────────────────────────────────────────

function RuleBuilderInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editRuleId = searchParams.get('ruleId')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [scope, setScope] = useState<string>('CAMPAIGN')
  const [rootType, setRootType] = useState<'AND' | 'OR'>('AND')
  const [conditions, setConditions] = useState<BuilderCondition[]>([newLeaf()])
  const [actions, setActions] = useState<BuilderAction[]>([newAction()])
  const [campaigns, setCampaigns] = useState<CampaignSession[]>([])
  const [campaignId, setCampaignId] = useState('')
  const [cooldown, setCooldown] = useState('60')
  const [saving, setSaving] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null)
  const [dryRunLoading, setDryRunLoading] = useState(false)

  useEffect(() => {
    fetch('/api/admin/campaign-sessions', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { sessions: [] })
      .then(d => setCampaigns(d.sessions ?? []))
      .catch(() => {})
  }, [])

  // Edit mode: load existing rule
  useEffect(() => {
    if (!editRuleId) return
    fetch(`/api/admin/automation-rules/${editRuleId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const rule = d?.rule
        if (!rule) return
        setName(rule.name ?? '')
        setDescription(rule.description ?? '')
        setScope(rule.scope ?? 'CAMPAIGN')
        setCampaignId(rule.campaignSessionId ?? '')
        setCooldown(String(rule.cooldownMinutes ?? 60))
        try {
          const tree = typeof rule.conditionTreeJson === 'string' ? JSON.parse(rule.conditionTreeJson) : rule.conditionTreeJson
          if (tree?.conditions) {
            setRootType(tree.type === 'OR' ? 'OR' : 'AND')
            setConditions(tree.conditions.map((c: Record<string, unknown>) => {
              if (c.type && Array.isArray(c.conditions)) {
                return {
                  kind: 'group' as const,
                  type: c.type === 'OR' ? 'OR' as const : 'AND' as const,
                  children: (c.conditions as Array<Record<string, unknown>>).map(l => ({
                    kind: 'leaf' as const,
                    metric: String(l.metric ?? 'spend'),
                    operator: String(l.operator ?? '>'),
                    value: String(l.value ?? ''),
                  })),
                }
              }
              return { kind: 'leaf' as const, metric: String(c.metric ?? 'spend'), operator: String(c.operator ?? '>'), value: String(c.value ?? '') }
            }))
          }
          const spec = typeof rule.actionSpecJson === 'string' ? JSON.parse(rule.actionSpecJson) : rule.actionSpecJson
          const specActions = spec?.type === 'MULTI' && Array.isArray(spec.actions) ? spec.actions : [spec]
          setActions(specActions.filter(Boolean).map((s: Record<string, unknown>) => ({
            type: String(s.type ?? 'PAUSE_CAMPAIGN'),
            multiplier: s.multiplier !== undefined ? String(s.multiplier) : undefined,
            renameMode: (s.mode as 'append' | 'remove') ?? 'append',
            renameTag: s.tag !== undefined ? String(s.tag) : undefined,
            message: s.message !== undefined ? String(s.message) : undefined,
          })))
        } catch { /* keep defaults */ }
      })
      .catch(() => {})
  }, [editRuleId])

  const updateCondition = (i: number, c: BuilderCondition) => {
    setConditions(prev => prev.map((p, idx) => idx === i ? c : p))
  }
  const removeCondition = (i: number) => {
    setConditions(prev => prev.filter((_, idx) => idx !== i))
  }

  const validate = (): string | null => {
    if (!name.trim()) return 'Nama rule wajib diisi.'
    const allLeaves = conditions.flatMap(c => c.kind === 'group' ? c.children : [c])
    if (allLeaves.length === 0) return 'Minimal 1 condition.'
    if (allLeaves.some(l => l.value === '')) return 'Semua condition harus punya value.'
    if (actions.length === 0) return 'Minimal 1 action.'
    for (const a of actions) {
      if (a.type === 'UPDATE_BUDGET' && (!a.multiplier || isNaN(Number(a.multiplier)))) return 'UPDATE_BUDGET butuh multiplier angka.'
      if (a.type === 'RENAME_ENTITY' && !a.renameTag?.trim()) return 'RENAME_ENTITY butuh tag.'
    }
    return null
  }

  const handleDryRun = async () => {
    const v = validate()
    if (v && !v.includes('Nama')) { setError(v); return }
    setError(null)
    setDryRunLoading(true)
    setDryRun(null)
    try {
      const res = await fetch('/api/admin/automation-rules/dry-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          scope,
          campaignSessionId: campaignId || undefined,
          conditionTreeJson: buildConditionTree(rootType, conditions),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Dry-run failed')
      setDryRun(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dry-run failed')
    } finally {
      setDryRunLoading(false)
    }
  }

  const handleSave = async () => {
    const v = validate()
    if (v) { setError(v); return }
    setError(null)
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        scope,
        ruleCategory: conditions.some(c => c.kind === 'group') ? 'COMPOSITE' : 'THRESHOLD',
        campaignSessionId: campaignId || undefined,
        conditionTreeJson: buildConditionTree(rootType, conditions),
        actionSpecJson: buildActionSpec(actions),
        cooldownMinutes: Number(cooldown) || 60,
      }
      const url = editRuleId ? `/api/admin/automation-rules/${editRuleId}` : '/api/admin/automation-rules'
      const res = await fetch(url, {
        method: editRuleId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      router.push('/rules-editor')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveTemplate = async () => {
    const v = validate()
    if (v) { setError(v); return }
    setError(null)
    setSavingTemplate(true)
    try {
      const res = await fetch('/api/admin/rule-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          scope,
          ruleCategory: conditions.some(c => c.kind === 'group') ? 'COMPOSITE' : 'THRESHOLD',
          conditionTreeJson: buildConditionTree(rootType, conditions),
          actionSpecJson: buildActionSpec(actions),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save template failed')
      router.push('/rules-editor?tab=templates')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save template failed')
    } finally {
      setSavingTemplate(false)
    }
  }

  return (
    <div className="max-w-3xl">
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-2 text-sm">
        <Link href="/rules-editor" className="text-stone-500 hover:text-stone-700 dark:text-stone-400">Rules</Link>
        <span className="text-stone-300">/</span>
        <span className="font-medium text-stone-900 dark:text-stone-100">{editRuleId ? 'Edit Rule' : 'New Rule'}</span>
      </div>

      <h1 className="page-title mb-1">{editRuleId ? 'Edit Rule' : 'Rule Builder'}</h1>
      <p className="text-sm text-stone-500 mb-6">Custom conditions + multiple actions. Test dengan dry-run sebelum aktif.</p>

      <div className="space-y-5">
        {/* ── Basics ── */}
        <div className="card p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Rule Name <span className="text-red-500">*</span></label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Stop Loss — Spend > $100" className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Scope</label>
              <select value={scope} onChange={e => setScope(e.target.value)} className={`${inputCls} w-full`}>
                {SCOPES.map(s => <option key={s} value={s}>{s === 'CAMPAIGN' ? 'Campaign' : s === 'ADSET' ? 'Ad Set' : 'Ad'}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Campaign (optional)</label>
              <select value={campaignId} onChange={e => setCampaignId(e.target.value)} className={`${inputCls} w-full`}>
                <option value="">All campaigns</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Cooldown (minutes)</label>
              <input type="number" value={cooldown} onChange={e => setCooldown(e.target.value)} className={`${inputCls} w-full`} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Catatan internal" className={`${inputCls} w-full`} />
          </div>
        </div>

        {/* ── Conditions ── */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-violet-600 dark:text-violet-300 text-xs">▷</span>
              When
            </h2>
            <div className="flex items-center gap-1 text-xs bg-stone-100 dark:bg-stone-800 rounded-lg p-0.5">
              {(['AND', 'OR'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setRootType(t)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${rootType === t ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-50 shadow-sm' : 'text-stone-400'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {conditions.map((cond, i) => (
              <div key={i}>
                {i > 0 && (
                  <div className="flex items-center gap-2 my-2">
                    <div className="flex-1 border-t border-dashed border-stone-200 dark:border-stone-700" />
                    <span className="text-[10px] font-bold text-stone-400 uppercase">{rootType}</span>
                    <div className="flex-1 border-t border-dashed border-stone-200 dark:border-stone-700" />
                  </div>
                )}
                {cond.kind === 'leaf' ? (
                  <ConditionRow
                    cond={cond}
                    onChange={c => updateCondition(i, c)}
                    onRemove={() => removeCondition(i)}
                  />
                ) : (
                  <div className="p-3 rounded-xl border-2 border-dashed border-stone-200 dark:border-stone-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs bg-stone-100 dark:bg-stone-800 rounded-lg p-0.5">
                        {(['AND', 'OR'] as const).map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => updateCondition(i, { ...cond, type: t })}
                            className={`px-2 py-0.5 rounded-md font-medium transition-colors ${cond.type === t ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-50 shadow-sm' : 'text-stone-400'}`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      <button type="button" onClick={() => removeCondition(i)} className="text-xs text-stone-300 hover:text-red-500">✕ group</button>
                    </div>
                    {cond.children.map((leaf, j) => (
                      <ConditionRow
                        key={j}
                        cond={leaf}
                        onChange={c => updateCondition(i, { ...cond, children: cond.children.map((ch, idx) => idx === j ? c : ch) })}
                        onRemove={() => updateCondition(i, { ...cond, children: cond.children.filter((_, idx) => idx !== j) })}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => updateCondition(i, { ...cond, children: [...cond.children, newLeaf()] })}
                      className="text-xs text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      + Condition
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button
              type="button"
              onClick={() => setConditions(prev => [...prev, newLeaf()])}
              className="btn-ghost btn-sm"
            >
              + Condition
            </button>
            <button
              type="button"
              onClick={() => setConditions(prev => [...prev, { kind: 'group', type: 'OR', children: [newLeaf()] }])}
              className="btn-ghost btn-sm"
            >
              + Group
            </button>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="card p-5">
          <h2 className="section-title flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-300 text-xs">⚡</span>
            Then
          </h2>
          <div className="space-y-2">
            {actions.map((action, i) => (
              <ActionCard
                key={i}
                action={action}
                scope={scope}
                onChange={a => setActions(prev => prev.map((p, idx) => idx === i ? a : p))}
                onRemove={() => setActions(prev => prev.filter((_, idx) => idx !== i))}
                canRemove={actions.length > 1}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setActions(prev => [...prev, newAction()])}
            className="btn-ghost btn-sm mt-3"
          >
            + Add Task
          </button>
        </div>

        {/* ── Dry run results ── */}
        {dryRun && (
          <div className="card p-5">
            <h2 className="section-title mb-2">🔍 Preview (Dry Run)</h2>
            <p className="text-sm text-stone-500 mb-3">
              {dryRun.matched} dari {dryRun.evaluated} entity match
              {dryRun.withoutMetrics > 0 && ` · ${dryRun.withoutMetrics} tanpa data metrics`}
            </p>
            {dryRun.results.length === 0 ? (
              <p className="text-sm text-stone-400">Tidak ada entity dalam scope ini. Rule tetap bisa disimpan — akan jalan saat ada data.</p>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {dryRun.results.map(r => (
                  <div key={r.entityId} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${r.matched ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-stone-50 dark:bg-stone-800/40'}`}>
                    <span>{r.matched ? '✅' : '·'}</span>
                    <span className="font-medium text-stone-700 dark:text-stone-300 truncate flex-1">{r.entityName}</span>
                    {!r.hasMetrics && <span className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">no metrics</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-xl px-4 py-3">
            ⚠️ {error}
          </div>
        )}

        {/* ── Footer actions ── */}
        <div className="flex items-center justify-between pb-8">
          <button
            type="button"
            onClick={handleDryRun}
            disabled={dryRunLoading}
            className="btn-ghost"
          >
            {dryRunLoading ? 'Running...' : '🔍 Preview (Dry Run)'}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveTemplate}
              disabled={savingTemplate}
              className="btn-outline"
            >
              {savingTemplate ? 'Saving...' : 'Save as Template'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? 'Saving...' : editRuleId ? 'Save Changes' : 'Create Rule'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RuleBuilderPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-stone-400 text-sm">Loading...</div>}>
      <RuleBuilderInner />
    </Suspense>
  )
}
