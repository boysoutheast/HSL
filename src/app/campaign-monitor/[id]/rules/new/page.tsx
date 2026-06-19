'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

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

export default function AttachRulePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [templates, setTemplates] = useState<RuleTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [attaching, setAttaching] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(60)
  const [showOptions, setShowOptions] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/rule-templates', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data.templates ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleAttach = async (templateId: string) => {
    setAttaching(templateId)
    setError('')
    try {
      const res = await fetch(`/api/admin/campaign-sessions/${id}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          templateId,
          overrides: showOptions === templateId ? { cooldownMinutes: cooldown } : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to attach rule')
      router.push(`/campaign-monitor/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setAttaching(null)
    }
  }

  const conditionSummary = (json: string): string => {
    try {
      const parsed = JSON.parse(json)
      const parts: string[] = []
      if (parsed.operator) parts.push(parsed.operator)
      if (parsed.conditions) {
        for (const c of parsed.conditions) {
          parts.push(`${c.metric} ${c.operator} ${c.value}`)
        }
      }
      return parts.join(' ') || json.slice(0, 60)
    } catch {
      return json.slice(0, 60)
    }
  }

  const actionSummary = (json: string): string => {
    try {
      const parsed = JSON.parse(json)
      const action = parsed.action ?? ''
      const p = parsed.params ?? {}
      if (action === 'update_budget' || action === 'scale_budget') {
        if (p.percentage) return `Budget ${p.percentage > 0 ? '+' : ''}${p.percentage}%`
        if (p.fixedAmount) return `Budget → Rp ${Number(p.fixedAmount).toLocaleString('id-ID')}`
      }
      if (action === 'pause_adset') return 'Pause Ad Set'
      if (action === 'pause_campaign') return 'Pause Campaign'
      if (action === 'notify') return `Notify: ${p.kind ?? 'alert'}`
      return action ?? json.slice(0, 60)
    } catch {
      return json.slice(0, 60)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/campaign-monitor/${id}`} className="text-stone-400 hover:text-stone-600 text-sm">← Back to Campaign</Link>
      </div>

      <h1 className="text-xl font-bold text-stone-900 mb-1">Attach Rule Template</h1>
      <p className="text-sm text-stone-500 mb-6">
        Select a template to attach to this campaign. Rules become active immediately.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48 text-stone-400 text-sm">Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-stone-400 text-sm gap-2">
          <svg className="w-12 h-12 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p>No rule templates available.</p>
          <Link href="/rules-editor" className="btn-ghost btn-sm">Create a rule template</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-stone-200 p-4 hover:border-violet-300 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-stone-900">{t.name}</p>
                    {t.isBuiltin && (
                      <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-medium">Built-in</span>
                    )}
                    <span className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded font-medium">{t.scope}</span>
                    <span className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded font-medium">{t.ruleCategory}</span>
                  </div>
                  {t.description && (
                    <p className="text-xs text-stone-500 mb-2">{t.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-stone-600 bg-stone-50 rounded px-3 py-1.5">
                    <span className="font-mono">IF {conditionSummary(t.conditionTreeJson)}</span>
                    <span className="text-stone-300">→</span>
                    <span className="font-mono">{actionSummary(t.actionSpecJson)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => handleAttach(t.id)}
                  disabled={attaching === t.id}
                  className="btn-primary btn-sm"
                >
                  {attaching === t.id ? 'Attaching...' : 'Attach'}
                </button>
                <button
                  onClick={() => setShowOptions(showOptions === t.id ? null : t.id)}
                  className="btn-ghost btn-sm"
                >
                  Options
                </button>
              </div>

              {showOptions === t.id && (
                <div className="mt-3 pt-3 border-t border-stone-200">
                  <label className="block text-xs text-stone-600 font-medium mb-1">Cooldown (minutes)</label>
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
          ))}
        </div>
      )}
    </div>
  )
}
