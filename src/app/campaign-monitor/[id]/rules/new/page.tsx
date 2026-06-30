'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ruleToReadable } from '@/lib/rule-readable'

interface RuleTemplate {
  id: string
  name: string
  description: string | null
  scope: string
  ruleCategory: string
  conditionTreeJson: string
  actionSpecJson: string
  isBuiltin: boolean
  usageCount: number
}

interface Condition {
  metric: string
  operator: string
  value: number | string
  type?: string
}

interface ConditionTree {
  operator?: string
  op?: string
  conditions?: (Condition | ConditionTree)[]
  children?: (Condition | ConditionTree)[]
}

interface ActionSpec {
  action: string
  params?: Record<string, unknown>
}

/**
 * Parse condition tree to extract {metric, label, default} for editable params.
 * Only number-typed conditions are editable.
 */
function getEditableConditions(json: string): { key: string; label: string; defaultValue: number }[] {
  try {
    const tree: ConditionTree = JSON.parse(json)
    // Support both rule-engine ('children') and legacy ('conditions') shapes
    const nodes = (tree.children ?? tree.conditions) as Condition[] | undefined
    if (!nodes) return []
    const result: { key: string; label: string; defaultValue: number }[] = []
    const labels: Record<string, string> = {
      roas: 'ROAS', spend: 'Spend (Rp)', purchases: 'Pembelian',
      cpc: 'CPC (Rp)', ctr: 'CTR (%)', impressions: 'Impressions',
      frequency: 'Frequency', leads: 'Leads', cpm: 'CPM (Rp)', cplc: 'CPLC (Rp)',
      adset_age_days: 'Umur adset (hari)', roas_min_7d: 'ROAS min 7h',
      cpa_change_pct_3d: 'CPA Δ% 3h', frequency_max_7d: 'Frequency max 7h',
    }
    for (const c of nodes) {
      const cond = c as Condition
      // rule-engine leaves don't carry `type`; accept any numeric leaf with a metric
      if (cond.metric && typeof cond.value === 'number') {
        result.push({
          key: cond.metric,
          label: labels[cond.metric] ?? cond.metric,
          defaultValue: cond.value,
        })
      }
    }
    return result
  } catch { return [] }
}

/**
 * Parse action spec to extract editable action params.
 */
function getEditableActionParams(json: string): { key: string; label: string; defaultValue: number }[] {
  try {
    const spec = JSON.parse(json) as ActionSpec & { mode?: string; amount?: number }
    const result: { key: string; label: string; defaultValue: number }[] = []
    // Legacy format: params.percentage / params.fixedAmount
    if (spec.params) {
      if (typeof spec.params.percentage === 'number') {
        result.push({ key: 'percentage', label: 'Persentase (%)', defaultValue: spec.params.percentage })
      }
      if (typeof spec.params.fixedAmount === 'number') {
        result.push({ key: 'fixedAmount', label: 'Jumlah (Rp)', defaultValue: spec.params.fixedAmount })
      }
    }
    // rule-engine format: { mode: 'increase_pct'|'decrease_pct', amount } — server maps params.percentage → amount
    if (result.length === 0 && (spec.mode === 'increase_pct' || spec.mode === 'decrease_pct') && typeof spec.amount === 'number') {
      result.push({ key: 'percentage', label: `Budget ${spec.mode === 'increase_pct' ? '+' : '-'}%`, defaultValue: spec.amount })
    }
    return result
  } catch { return [] }
}

export default function AttachRulePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [templates, setTemplates] = useState<RuleTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [attaching, setAttaching] = useState<string | null>(null)
  const [error, setError] = useState('')
  // Per-template param values: templateId → { metricKey: value, ... }
  const [paramValues, setParamValues] = useState<Record<string, Record<string, number>>>({})
  const [cooldown, setCooldown] = useState(60)
  const [showOptions, setShowOptions] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/rule-templates', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        const tpls = data.templates ?? []
        setTemplates(tpls)
        // Init param values with defaults
        const defaults: Record<string, Record<string, number>> = {}
        for (const t of tpls) {
          const condEditable = getEditableConditions(t.conditionTreeJson)
          const actEditable = getEditableActionParams(t.actionSpecJson)
          defaults[t.id] = {}
          for (const e of [...condEditable, ...actEditable]) {
            defaults[t.id][e.key] = e.defaultValue
          }
        }
        setParamValues(defaults)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleAttach = async (templateId: string) => {
    setAttaching(templateId)
    setError('')
    try {
      const params = paramValues[templateId]
      // Only send params that differ from template defaults (or send all)
      const body: Record<string, unknown> = {
        templateId,
        overrides: showOptions === templateId ? { cooldownMinutes: cooldown } : undefined,
      }
      if (params && Object.keys(params).length > 0) {
        body.params = params
      }

      const res = await fetch(`/api/admin/campaign-sessions/${id}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Gagal attach rule')
      router.push(`/campaign-monitor/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setAttaching(null)
    }
  }

  const updateParam = (templateId: string, key: string, value: number) => {
    setParamValues((prev) => ({
      ...prev,
      [templateId]: { ...prev[templateId], [key]: value },
    }))
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/campaign-monitor/${id}`} className="text-stone-400 hover:text-stone-600 text-sm">← Kembali</Link>
      </div>

      <h1 className="text-xl font-bold text-stone-900 mb-1">Pasang Aturan Otomatis</h1>
      <p className="text-sm text-stone-500 mb-6">
        Pilih template, atur angka sesuai keinginan, klik Pakai. Aturan langsung aktif.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48 text-stone-400 text-sm">Memuat template...</div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-stone-400 text-sm gap-2">
          <svg className="w-12 h-12 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p>Belum ada template. Buat dulu di halaman Rules Editor.</p>
          <Link href="/rules-editor" className="btn-ghost btn-sm">Buka Rules Editor</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => {
            const condEditable = getEditableConditions(t.conditionTreeJson)
            const actEditable = getEditableActionParams(t.actionSpecJson)
            const allEditable = [...condEditable, ...actEditable]
            const values = paramValues[t.id] ?? {}

            return (
              <div key={t.id} className="bg-white rounded-xl border border-stone-200 p-4 hover:border-violet-300 transition-colors">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-stone-900">{t.name}</p>
                      {t.isBuiltin && (
                        <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-medium">Built-in</span>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-xs text-stone-500 mb-2">{t.description}</p>
                    )}
                  </div>
                </div>

                {/* Readable condition + action */}
                <div className="text-xs text-stone-600 bg-stone-50 rounded px-3 py-2 mb-3 font-mono">
                  {ruleToReadable(t.conditionTreeJson, t.actionSpecJson)}
                </div>

                {/* Inline-editable params */}
                {allEditable.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                    {allEditable.map((ed) => (
                      <div key={ed.key}>
                        <label className="block text-[10px] text-stone-500 font-medium mb-0.5">{ed.label}</label>
                        <input
                          type="number"
                          value={values[ed.key] ?? ed.defaultValue}
                          onChange={(e) => updateParam(t.id, ed.key, Number(e.target.value))}
                          min={0}
                          className="w-full border border-stone-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => handleAttach(t.id)}
                    disabled={attaching === t.id}
                    className="btn-primary btn-sm"
                  >
                    {attaching === t.id ? 'Memasang...' : 'Pakai'}
                  </button>
                  <button
                    onClick={() => setShowOptions(showOptions === t.id ? null : t.id)}
                    className="btn-ghost btn-sm text-xs"
                  >
                    ⚙️ Cooldown
                  </button>
                </div>

                {showOptions === t.id && (
                  <div className="mt-3 pt-3 border-t border-stone-200">
                    <label className="block text-xs text-stone-600 font-medium mb-1">
                      Jeda minimal antar eksekusi (menit)
                    </label>
                    <input
                      type="number"
                      value={cooldown}
                      onChange={(e) => setCooldown(Number(e.target.value))}
                      min={5}
                      max={1440}
                      className="w-24 border border-stone-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                )}
              </div>
            )
          })}

          {/* Advanced link */}
          <div className="text-center pt-4 border-t border-stone-200 mt-6">
            <Link
              href="/rules-editor"
              className="text-xs text-stone-500 hover:text-stone-700 hover:underline"
            >
              ⚙️ Buat aturan sendiri (advanced) → Buka Rules Editor
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
