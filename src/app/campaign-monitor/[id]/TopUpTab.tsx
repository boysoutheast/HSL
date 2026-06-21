'use client'

import { useEffect, useState, useCallback } from 'react'
import { HelpHint } from '@/components/ui/HelpHint'

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

export default function TopUpTab({ sessionId, compact }: { sessionId: string; compact?: boolean }) {
  const [minActiveAds, setMinActiveAds] = useState(0)
  const [topupEnabled, setTopupEnabled] = useState(false)
  const [topupTargetAdsetId, setTopupTargetAdsetId] = useState('')
  const [pools, setPools] = useState<PoolItem[]>([])
  const [counts, setCounts] = useState<PoolCounts>({ available: 0, used: 0, failed: 0, archived: 0 })
  const [logs, setLogs] = useState<TopupLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newCreative, setNewCreative] = useState({ primaryText: '', headline: '', description: '', callToAction: 'LEARN_MORE', linkUrl: '' })
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedMediaAssetId, setSelectedMediaAssetId] = useState<string | null>(null)
  const [selectedMediaThumb, setSelectedMediaThumb] = useState<string | null>(null)
  const [mediaMode, setMediaMode] = useState<'library' | 'upload'>('library')
  const [libraryAssets, setLibraryAssets] = useState<{id:string;fileUrl:string|null;publicUrl:string|null;label:string|null}[]>([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

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

  // Fetch library assets
  const fetchLibrary = async () => {
    setLibraryLoading(true)
    try {
      const res = await fetch('/api/admin/media-assets?type=IMAGE&status=READY', { credentials: 'include' })
      if (res.ok) { const d = await res.json(); setLibraryAssets(d.assets ?? []) }
    } catch { /* silent */ }
    finally { setLibraryLoading(false) }
  }

  // Add creative
  const handleAddCreative = async () => {
    if (!newCreative.primaryText || !selectedMediaAssetId) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        primaryText: newCreative.primaryText,
        callToAction: newCreative.callToAction,
        mediaAssetId: selectedMediaAssetId,
      }
      if (newCreative.headline) body.headline = newCreative.headline
      if (newCreative.description) body.description = newCreative.description
      if (newCreative.linkUrl) body.linkUrl = newCreative.linkUrl

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
      setNewCreative({ primaryText: '', headline: '', description: '', callToAction: 'LEARN_MORE', linkUrl: '' })
      setSelectedMediaAssetId(null)
      setSelectedMediaThumb(null)
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
          <h2 className="text-sm font-bold text-stone-900">Auto Top-Up <HelpHint k="tu.enable" /></h2>
          <label data-tour="tu-enable" className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer bg-stone-300"
            style={{ backgroundColor: topupEnabled ? '#7c3aed' : '#d4d4d8' }}>
            <input type="checkbox" className="sr-only" checked={topupEnabled}
              onChange={() => setTopupEnabled(!topupEnabled)} />
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${topupEnabled ? 'translate-x-4' : 'translate-x-1'}`} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-stone-600 font-medium mb-1">Minimal Ads Aktif <HelpHint k="tu.minAds" /></label>
            <input type="number" min={0} max={50} value={minActiveAds}
              onChange={(e) => setMinActiveAds(Number(e.target.value))}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div>
            <label className="block text-xs text-stone-600 font-medium mb-1">Target Adset ID (opsional) <HelpHint k="tu.targetAdset" /></label>
            <input type="text" value={topupTargetAdsetId}
              onChange={(e) => setTopupTargetAdsetId(e.target.value)}
              placeholder="Kosong = adset pertama aktif"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleSaveSettings} disabled={saving} className="btn-primary btn-sm">
            {saving ? 'Saving...' : 'Save Settings'} <HelpHint k="tu.save" />
          </button>
          {topupEnabled && minActiveAds > 0 && (
            <button onClick={handleRunTopup} disabled={saving} className="btn-ghost btn-sm">
              Run Top-Up Now <HelpHint k="tu.runNow" />
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
            + Tambah Creative <HelpHint k="tu.addCreative" />
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

            {/* Media selector: Library | Upload */}
            <div>
              <label className="block text-xs text-stone-600 font-medium mb-2">Media *</label>
              <div className="flex items-center gap-2 mb-3">
                <button type="button" onClick={() => { setMediaMode('library'); if (libraryAssets.length===0) fetchLibrary() }}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${mediaMode==='library'?'bg-violet-100 text-violet-800':'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>📚 Library</button>
                <button type="button" onClick={() => setMediaMode('upload')}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${mediaMode==='upload'?'bg-violet-100 text-violet-800':'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>⬆️ Upload</button>
              </div>

              {/* Preview kalau udah punya */}
              {selectedMediaThumb && (
                <div className="relative inline-block mb-2">
                  <img src={selectedMediaThumb} alt="Preview" className="w-20 h-20 rounded-lg object-cover border border-stone-300" />
                  <button type="button" onClick={() => { setSelectedMediaAssetId(null); setSelectedMediaThumb(null) }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs leading-none hover:bg-red-600">✕</button>
                </div>
              )}

              {/* Library grid */}
              {mediaMode === 'library' && (
                <div>
                  {libraryLoading ? (
                    <p className="text-xs text-stone-400 py-2">Loading library...</p>
                  ) : libraryAssets.length === 0 ? (
                    <p className="text-xs text-stone-400 py-2">Belum ada gambar di library. Upload dulu.</p>
                  ) : (
                    <div className="grid grid-cols-5 gap-1.5 max-h-32 overflow-y-auto">
                      {libraryAssets.map((a) => {
                        const url = a.fileUrl ?? a.publicUrl ?? ''
                        const isSelected = selectedMediaAssetId === a.id
                        return (
                          <button key={a.id} type="button" onClick={() => { setSelectedMediaAssetId(a.id); setSelectedMediaThumb(url) }}
                            className={`aspect-square rounded-lg overflow-hidden border-2 transition ${isSelected ? 'border-violet-500 ring-2 ring-violet-200' : 'border-stone-200 hover:border-violet-300'}`}>
                            {url && <img src={url} alt={a.label ?? ''} className="w-full h-full object-cover" />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Upload mode */}
              {mediaMode === 'upload' && (
                <div>
                  <label className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed cursor-pointer text-sm font-medium transition ${
                    uploading ? 'border-stone-200 text-stone-300 cursor-not-allowed' : 'border-violet-200 text-violet-600 hover:border-violet-400 hover:bg-violet-50'
                  }`}>
                    <input type="file" accept="image/*" className="sr-only" disabled={uploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setUploading(true)
                        try {
                          const fd = new FormData()
                          fd.append('file', file)
                          fd.append('label', `Topup-${sessionId}`)
                          const r = await fetch('/api/admin/media-assets/upload', {
                            method: 'POST', credentials: 'include', body: fd,
                          })
                          const d = await r.json()
                          if (r.ok && d.asset) {
                            const url = d.asset.fileUrl ?? d.asset.publicUrl ?? ''
                            setSelectedMediaAssetId(d.asset.id)
                            setSelectedMediaThumb(url)
                          } else {
                            setError(d.error ?? 'Upload gagal')
                          }
                        } catch {
                          setError('Network error')
                        }
                        setUploading(false)
                      }}
                    />
                    {uploading ? 'Uploading...' : '↑ Upload gambar'}
                  </label>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs text-stone-600 font-medium mb-1">Link URL (opsional)</label>
              <input type="text" value={newCreative.linkUrl} onChange={(e) => setNewCreative({ ...newCreative, linkUrl: e.target.value })}
                placeholder="https://shopee.co.id/..."
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <button onClick={handleAddCreative} disabled={saving || !newCreative.primaryText || !selectedMediaAssetId} className="btn-primary btn-sm">
              {saving ? 'Adding...' : 'Add to Pool'} <HelpHint k="tu.addToPool" />
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

      {/* Top-Up Activity Log — hidden in compact mode (shown in Activity tab) */}
      {!compact && (
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
      )}
    </div>
  )
}
