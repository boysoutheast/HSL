'use client'

import { useEffect, useState, useCallback } from 'react'

interface PoolItem {
  id: string
  primaryText: string
  headline: string | null
  description: string | null
  callToAction: string
  linkUrl: string | null
  mediaAssetId: string | null
  creativeUrl: string | null
  format: string
  sortOrder: number
  status: string
  usedAt: string | null
  usedMetaAdId: string | null
  failedReason: string | null
}

interface PoolCounts {
  available: number
  used: number
  failed: number
  archived: number
}

interface TopupLog {
  id: string
  triggeredAt: string
  activeAdsBefore: number
  minActiveAds: number
  status: string
  poolCreativeId: string | null
  note: string | null
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function TopUpTab({ sessionId }: { sessionId: string }) {
  const [minActiveAds, setMinActiveAds] = useState(0)
  const [topupEnabled, setTopupEnabled] = useState(false)
  const [topupTargetAdsetId, setTopupTargetAdsetId] = useState('')
  const [pools, setPools] = useState<PoolItem[]>([])
  const [counts, setCounts] = useState<PoolCounts>({ available: 0, used: 0, failed: 0, archived: 0 })
  const [logs, setLogs] = useState<TopupLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newCreative, setNewCreative] = useState({ primaryText: '', headline: '', description: '', callToAction: 'LEARN_MORE', linkUrl: '', mediaUrl: '' })
  const [showAddForm, setShowAddForm] = useState(false)

  // Fetch session + pool + logs
  const fetchAll = useCallback(async () => {
    try {
      const [sessionRes, poolRes, logRes] = await Promise.all([
        fetch(`/api/admin/campaign-sessions/${sessionId}`, { credentials: 'include' }),
        fetch(`/api/admin/campaign-sessions/${sessionId}/creative-pool`, { credentials: 'include' }),
        fetch(`/api/admin/campaign-sessions/${sessionId}/topup-log`, { credentials: 'include' }),
      ])
      if (sessionRes.ok) {
        const s = await sessionRes.json()
        setMinActiveAds(s.session.minActiveAds ?? 0)
        setTopupEnabled(s.session.topupEnabled ?? false)
        setTopupTargetAdsetId(s.session.topupTargetAdsetId ?? '')
      }
      if (poolRes.ok) {
        const p = await poolRes.json()
        setPools(p.items ?? [])
        setCounts(p.counts ?? { available: 0, used: 0, failed: 0, archived: 0 })
      }
      if (logRes.ok) {
        const l = await logRes.json()
        setLogs(l.logs ?? [])
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [sessionId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Save floor settings
  const handleSaveSettings = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/campaign-sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          minActiveAds,
          topupEnabled,
          topupTargetAdsetId: topupTargetAdsetId || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to save')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving settings')
    } finally { setSaving(false) }
  }

  // Add creative
  const handleAddCreative = async () => {
    if (!newCreative.primaryText) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        primaryText: newCreative.primaryText,
        callToAction: newCreative.callToAction,
      }
      if (newCreative.headline) body.headline = newCreative.headline
      if (newCreative.description) body.description = newCreative.description
      if (newCreative.linkUrl) body.linkUrl = newCreative.linkUrl
      if (newCreative.mediaUrl) body.creativeUrl = newCreative.mediaUrl

      const res = await fetch(`/api/admin/campaign-sessions/${sessionId}/creative-pool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to add')
      }
      setNewCreative({ primaryText: '', headline: '', description: '', callToAction: 'LEARN_MORE', linkUrl: '', mediaUrl: '' })
      setShowAddForm(false)
      fetchAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error adding creative')
    } finally { setSaving(false) }
  }

  // Manual top-up trigger
  const handleRunTopup = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/campaign-sessions/${sessionId}/topup/run`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Run failed')
      fetchAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally { setSaving(false) }
  }

  if (loading) return <div className="text-center py-12 text-stone-400 text-sm">Loading top-up...</div>

  const STATUS_COLORS: Record<string, string> = {
    available: 'bg-violet-100 text-violet-700',
    used: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    archived: 'bg-stone-100 text-stone-500',
  }
  const LOG_STATUS: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    succeeded: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    skipped_empty_pool: 'bg-orange-100 text-orange-700',
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Floor Settings */}
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-stone-900">Auto Top-Up</h2>
          <label className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer bg-stone-300"
            style={{ backgroundColor: topupEnabled ? '#7c3aed' : '#d4d4d8' }}>
            <input type="checkbox" className="sr-only" checked={topupEnabled}
              onChange={() => setTopupEnabled(!topupEnabled)} />
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${topupEnabled ? 'translate-x-4' : 'translate-x-1'}`} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-stone-600 font-medium mb-1">Minimal Ads Aktif</label>
            <input type="number" min={0} max={50} value={minActiveAds}
              onChange={(e) => setMinActiveAds(Number(e.target.value))}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div>
            <label className="block text-xs text-stone-600 font-medium mb-1">Target Adset ID (opsional)</label>
            <input type="text" value={topupTargetAdsetId}
              onChange={(e) => setTopupTargetAdsetId(e.target.value)}
              placeholder="Kosong = adset pertama aktif"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleSaveSettings} disabled={saving} className="btn-primary btn-sm">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {topupEnabled && minActiveAds > 0 && (
            <button onClick={handleRunTopup} disabled={saving} className="btn-ghost btn-sm">
              Run Top-Up Now
            </button>
          )}
          <span className="text-xs text-stone-500 ml-auto">
            {counts.available} creative available · Pool status: {minActiveAds > 0 ? `floor ${minActiveAds}` : 'off'}
          </span>
        </div>
      </div>

      {/* Creative Pool Manager */}
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-stone-900">
            Creative Pool
            <span className="text-xs font-normal text-stone-500 ml-2">
              {counts.available} available · {counts.used} used · {counts.failed} failed
            </span>
          </h2>
          <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary btn-sm">
            + Tambah Creative
          </button>
        </div>

        {/* Add form */}
        {showAddForm && (
          <div className="bg-stone-50 rounded-lg p-4 mb-4 space-y-3 border border-stone-200">
            <div>
              <label className="block text-xs text-stone-600 font-medium mb-1">Primary Text *</label>
              <textarea value={newCreative.primaryText} onChange={(e) => setNewCreative({ ...newCreative, primaryText: e.target.value })}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" rows={2} maxLength={2000} />
              <p className="text-[10px] text-stone-400 mt-0.5">{newCreative.primaryText.length}/2000</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-stone-600 font-medium mb-1">Headline</label>
                <input type="text" value={newCreative.headline} onChange={(e) => setNewCreative({ ...newCreative, headline: e.target.value })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="block text-xs text-stone-600 font-medium mb-1">CTA</label>
                <select value={newCreative.callToAction} onChange={(e) => setNewCreative({ ...newCreative, callToAction: e.target.value })}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="LEARN_MORE">Learn More</option>
                  <option value="SHOP_NOW">Shop Now</option>
                  <option value="SIGN_UP">Sign Up</option>
                  <option value="BUY_NOW">Buy Now</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-stone-600 font-medium mb-1">Link URL or Media URL</label>
              <input type="text" value={newCreative.mediaUrl} onChange={(e) => setNewCreative({ ...newCreative, mediaUrl: e.target.value })}
                placeholder="https://..."
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <button onClick={handleAddCreative} disabled={saving || !newCreative.primaryText} className="btn-primary btn-sm">
              {saving ? 'Adding...' : 'Add to Pool'}
            </button>
          </div>
        )}

        {/* Pool list */}
        {pools.length === 0 ? (
          <div className="text-center py-8 text-stone-400 text-sm">Belum ada creative. Tambah minimal 1 untuk top-up.</div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {pools.map((p) => (
              <div key={p.id} className={`flex items-start gap-3 px-4 py-3 rounded-lg border transition-colors ${
                p.status === 'used' ? 'border-green-200 bg-green-50/30' :
                p.status === 'failed' ? 'border-red-200 bg-red-50/30' :
                p.status === 'archived' ? 'border-stone-200 bg-stone-50' :
                'border-stone-200 hover:border-violet-300'
              }`}>
                <span className="text-xs text-stone-400 font-mono mt-0.5 w-6 shrink-0">#{p.sortOrder + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900 truncate">{p.primaryText}</p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {p.headline && `${p.headline} · `}CTA: {p.callToAction}
                    {p.linkUrl && ` · ${p.linkUrl.slice(0, 40)}...`}
                  </p>
                  {p.usedMetaAdId && <p className="text-xs text-stone-400 mt-0.5">→ ad: {p.usedMetaAdId}</p>}
                  {p.failedReason && <p className="text-xs text-red-500 mt-0.5">Failed: {p.failedReason}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[p.status] ?? 'bg-stone-100'}`}>
                    {p.status}
                  </span>
                  {p.usedAt && <span className="text-[10px] text-stone-400">{fmtDate(p.usedAt)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top-Up Activity Log */}
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <h2 className="text-sm font-bold text-stone-900 mb-4">Riwayat Top-Up</h2>
        {logs.length === 0 ? (
          <div className="text-center py-6 text-stone-400 text-sm">Belum ada aktivitas top-up.</div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-stone-50">
                <span className="text-xs text-stone-400 w-16 shrink-0">{fmtDate(log.triggeredAt)}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${LOG_STATUS[log.status] ?? 'bg-stone-100'}`}>
                  {log.status}
                </span>
                <p className="text-xs text-stone-600 flex-1">
                  {log.activeAdsBefore}→? ads · floor {log.minActiveAds}
                  {log.note && ` · ${log.note}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
