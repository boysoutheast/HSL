'use client'

import { useEffect, useState, useCallback } from 'react'
import PageInfo from '@/components/ui/PageInfo'
import Modal from '@/components/ui/Modal'
import StatusBadge from '@/components/ui/StatusBadge'
import Table from '@/components/ui/Table'

interface MediaRule {
  id: string
  name: string
  triggerType: string
  threshold: number
  mediaType: string
  actionType: string
  taskType: string | null
  status: string
  cooldownHours: number
  lastTriggeredAt: string | null
  triggerCount: number
  product: { id: string; name: string } | null
  character: { id: string; name: string } | null
}

interface Product { id: string; name: string }
interface Character { id: string; name: string }

const TRIGGER_LABELS: Record<string, string> = {
  MIN_COUNT: 'Media count di bawah',
  MAX_AGE_DAYS: 'Media terbaru lebih tua dari (hari)',
  NO_WINNER: 'Tidak ada winner (score ≥)',
}

const inputCls = 'w-full border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500'

export default function MediaRulesPage() {
  const [rules, setRules] = useState<MediaRule[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    triggerType: 'MIN_COUNT',
    threshold: '5',
    scopeType: 'product' as 'product' | 'character',
    productId: '',
    characterId: '',
    mediaType: 'VIDEO',
    taskType: 'GENERATE_VIDEO',
    cooldownHours: '24',
  })

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/media-rules', { credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setRules(data.rules ?? [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchRules()
    fetch('/api/admin/products?status=active', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { products: [] })
      .then(d => setProducts(d.products ?? d ?? []))
      .catch(() => {})
    fetch('/api/admin/characters', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { characters: [] })
      .then(d => setCharacters(d.characters ?? []))
      .catch(() => {})
  }, [fetchRules])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/media-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: form.name,
          triggerType: form.triggerType,
          threshold: Number(form.threshold),
          productId: form.scopeType === 'product' ? form.productId || undefined : undefined,
          characterId: form.scopeType === 'character' ? form.characterId || undefined : undefined,
          mediaType: form.mediaType,
          actionType: 'CREATE_TASK',
          taskType: form.taskType,
          cooldownHours: Number(form.cooldownHours),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setShowModal(false)
      await fetchRules()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rule')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (rule: MediaRule) => {
    await fetch(`/api/admin/media-rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: rule.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' }),
    })
    await fetchRules()
  }

  const handleDelete = async (rule: MediaRule) => {
    if (!confirm(`Hapus rule "${rule.name}"?`)) return
    await fetch(`/api/admin/media-rules/${rule.id}`, { method: 'DELETE', credentials: 'include' })
    await fetchRules()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Media Rules</h1>
          <p className="text-sm text-stone-500 mt-0.5">Auto top-up konten: trigger worker generate saat library menipis.</p>
        </div>
        <button onClick={() => { setShowModal(true); setError(null) }} className="btn-primary">+ New Rule</button>
      </div>

      <PageInfo
        purpose="Rules yang ngecek media library tiap jam (cron). Kalau kondisi kena (stok media kurang, konten kelamaan, nggak ada winner) → otomatis bikin task generate untuk AI Buddy worker."
        inputs={[
          'Trigger: MIN_COUNT / MAX_AGE_DAYS / NO_WINNER',
          'Threshold sesuai trigger',
          'Scope: product atau character',
          'Task type yang dibuat saat trigger',
        ]}
        wiring={[
          { label: '→ WorkerTask', desc: 'rule yang kena bikin task GENERATE_VIDEO/PHOTO' },
          { label: '→ AI Buddy /tasks', desc: 'worker claim task lalu generate + upload hasil' },
          { label: '← Cron /api/cron/media-rules', desc: 'evaluator jalan tiap jam' },
        ]}
      />

      {loading ? (
        <div className="flex items-center justify-center h-40 text-stone-400 text-sm">Loading...</div>
      ) : (
        <Table
          headers={['Name', 'Trigger', 'Scope', 'Media', 'Task', 'Status', 'Triggered', 'Last Trigger', '']}
          empty="Belum ada media rule. Bikin rule pertama untuk auto top-up konten."
        >
          {rules.map(rule => (
            <tr key={rule.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors">
              <td className="px-4 py-3 font-medium text-stone-800 dark:text-stone-200">{rule.name}</td>
              <td className="px-4 py-3 text-stone-600 dark:text-stone-400 text-xs">
                {TRIGGER_LABELS[rule.triggerType] ?? rule.triggerType} <strong>{rule.threshold}</strong>
              </td>
              <td className="px-4 py-3 text-stone-600 dark:text-stone-400 text-xs">
                {rule.product?.name ?? rule.character?.name ?? '—'}
              </td>
              <td className="px-4 py-3 text-xs text-stone-500">{rule.mediaType}</td>
              <td className="px-4 py-3 text-xs text-stone-500">{rule.taskType ?? '—'}</td>
              <td className="px-4 py-3">
                <button onClick={() => handleToggle(rule)} title="Toggle status">
                  <StatusBadge status={rule.status === 'ACTIVE' ? 'active' : 'inactive'} />
                </button>
              </td>
              <td className="px-4 py-3 text-stone-500">{rule.triggerCount}×</td>
              <td className="px-4 py-3 text-xs text-stone-400 whitespace-nowrap">
                {rule.lastTriggeredAt ? new Date(rule.lastTriggeredAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
              </td>
              <td className="px-4 py-3">
                <button onClick={() => handleDelete(rule)} className="text-stone-300 hover:text-red-500 text-xs">🗑</button>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Media Rule">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Rule Name <span className="text-red-500">*</span></label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className={inputCls} placeholder="Auto top-up video Produk X" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Trigger</label>
              <select value={form.triggerType} onChange={e => setForm({ ...form, triggerType: e.target.value })} className={inputCls}>
                <option value="MIN_COUNT">Media count minimum</option>
                <option value="MAX_AGE_DAYS">Umur media maksimal</option>
                <option value="NO_WINNER">Tidak ada winner</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                {form.triggerType === 'MIN_COUNT' ? 'Min count' : form.triggerType === 'MAX_AGE_DAYS' ? 'Max umur (hari)' : 'Min score'}
              </label>
              <input type="number" value={form.threshold} onChange={e => setForm({ ...form, threshold: e.target.value })} required className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Scope</label>
              <select value={form.scopeType} onChange={e => setForm({ ...form, scopeType: e.target.value as 'product' | 'character' })} className={inputCls}>
                <option value="product">Product</option>
                <option value="character">Character</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{form.scopeType === 'product' ? 'Product' : 'Character'}</label>
              {form.scopeType === 'product' ? (
                <select value={form.productId} onChange={e => setForm({ ...form, productId: e.target.value })} required className={inputCls}>
                  <option value="">Pilih product...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              ) : (
                <select value={form.characterId} onChange={e => setForm({ ...form, characterId: e.target.value })} required className={inputCls}>
                  <option value="">Pilih character...</option>
                  {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Media Type</label>
              <select value={form.mediaType} onChange={e => setForm({ ...form, mediaType: e.target.value })} className={inputCls}>
                <option value="VIDEO">Video</option>
                <option value="IMAGE">Image</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Task</label>
              <select value={form.taskType} onChange={e => setForm({ ...form, taskType: e.target.value })} className={inputCls}>
                <option value="GENERATE_VIDEO">Generate Video</option>
                <option value="GENERATE_PHOTO">Generate Photo</option>
                <option value="CAPTION_ONLY">Caption Only</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Cooldown (jam)</label>
              <input type="number" value={form.cooldownHours} onChange={e => setForm({ ...form, cooldownHours: e.target.value })} className={inputCls} />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 text-red-700 dark:text-red-300 text-sm rounded-lg px-3 py-2">⚠️ {error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Create Rule'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
