'use client'

import { useEffect, useState } from 'react'

interface GraveyardEntry {
  id: string
  metaAdsetId: string
  adsetName: string
  productKey: string
  killTier: string
  killReason: string
  spendAtKill: number
  catalogROASAtKill: number | null
  cplcAtKill: number | null
  killCount: number
  lastKilledAt: string
}

interface DiaryEntry {
  id: string
  period: string
  productKey: string | null
  killedThisRun: number | null
  spawnedThisRun: number | null
  avgROAS7d: number | null
  summaryText: string | null
  createdAt: string
}

interface PainEntry {
  id: string
  productKey: string
  painText: string
  exchangeValues: string[]
  deliveryStyles: string[]
  isActive: boolean
}

interface SpawnJob {
  id: string
  type: string
  status: string
  createdAt: string
}

interface Stats {
  totalKilled: number
  repeatKills: number
  spawnPending: number
  painEntries: number
}

type SubTab = 'graveyard' | 'diary' | 'pain'

function fmt(n: number, type: 'currency' | 'decimal' | 'int' = 'int') {
  if (type === 'currency') return `Rp${Math.round(n).toLocaleString('id-ID')}`
  if (type === 'decimal') return n.toFixed(2)
  return n.toLocaleString('id-ID')
}

const TIER_COLOR: Record<string, string> = {
  T1: 'bg-red-100 text-red-700',
  T2: 'bg-orange-100 text-orange-700',
  T3: 'bg-yellow-100 text-yellow-700',
}

export default function CpasTab() {
  const [sub, setSub] = useState<SubTab>('graveyard')
  const [stats, setStats] = useState<Stats | null>(null)
  const [graveyard, setGraveyard] = useState<GraveyardEntry[]>([])
  const [diary, setDiary] = useState<DiaryEntry[]>([])
  const [pains, setPains] = useState<PainEntry[]>([])
  const [spawnJobs, setSpawnJobs] = useState<SpawnJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newPain, setNewPain] = useState({ productKey: '', painText: '', exchangeValues: '', deliveryStyles: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [gRes, dRes, pRes, jRes] = await Promise.all([
          fetch('/api/admin/cpas/graveyard?limit=50', { credentials: 'include' }),
          fetch('/api/admin/cpas/diary?limit=10', { credentials: 'include' }),
          fetch('/api/admin/cpas/pain-library', { credentials: 'include' }),
          fetch('/api/admin/workers?type=cpas&limit=20', { credentials: 'include' }),
        ])

        const [gData, dData, pData] = await Promise.all([
          gRes.ok ? gRes.json() : { entries: [] },
          dRes.ok ? dRes.json() : { entries: [] },
          pRes.ok ? pRes.json() : { pains: [] },
        ])

        const graveyardEntries: GraveyardEntry[] = gData.entries ?? []
        const diaryEntries: DiaryEntry[] = dData.entries ?? []
        const painEntries: PainEntry[] = pData.pains ?? []

        setGraveyard(graveyardEntries)
        setDiary(diaryEntries)
        setPains(painEntries)

        const repeatKills = graveyardEntries.filter(e => e.killCount > 1).length
        setStats({
          totalKilled: gData.total ?? graveyardEntries.length,
          repeatKills,
          spawnPending: 0,
          painEntries: painEntries.length,
        })
      } catch (e) {
        setError('Gagal load data CPAS')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleAddPain() {
    if (!newPain.productKey || !newPain.painText) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/cpas/pain-library', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productKey: newPain.productKey,
          painText: newPain.painText,
          exchangeValues: newPain.exchangeValues.split(',').map(s => s.trim()).filter(Boolean),
          deliveryStyles: newPain.deliveryStyles.split(',').map(s => s.trim()).filter(Boolean),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setPains(prev => [...prev, data.entry])
        setNewPain({ productKey: '', painText: '', exchangeValues: '', deliveryStyles: '' })
      }
    } finally {
      setSaving(false)
    }
  }

  async function togglePain(id: string, isActive: boolean) {
    await fetch('/api/admin/cpas/pain-library', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive: !isActive }),
    })
    setPains(prev => prev.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p))
  }

  if (loading) return <div className="text-sm text-stone-400 py-8 text-center">Loading CPAS data…</div>
  if (error) return <div className="text-sm text-red-500 py-4">{error}</div>

  const SUB_TABS: { id: SubTab; label: string }[] = [
    { id: 'graveyard', label: `Graveyard (${stats?.totalKilled ?? 0})` },
    { id: 'diary', label: `Diary (${diary.length})` },
    { id: 'pain', label: `Pain Library (${pains.length})` },
  ]

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Killed', value: stats?.totalKilled ?? 0 },
          { label: 'Repeat Failures', value: stats?.repeatKills ?? 0, warn: (stats?.repeatKills ?? 0) > 0 },
          { label: 'Pain Entries', value: stats?.painEntries ?? 0 },
          { label: 'Diary Entries', value: diary.length },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-3 ${s.warn ? 'border-amber-200 bg-amber-50' : 'border-stone-100 bg-stone-50'}`}>
            <p className="text-xs text-stone-500">{s.label}</p>
            <p className={`text-xl font-semibold ${s.warn ? 'text-amber-700' : 'text-stone-800'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Sub tabs */}
      <div className="flex gap-1 border-b border-stone-100">
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${sub === t.id ? 'bg-white border border-b-white border-stone-200 text-stone-800 -mb-px' : 'text-stone-500 hover:text-stone-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Graveyard */}
      {sub === 'graveyard' && (
        <div className="space-y-2">
          {graveyard.length === 0 && <p className="text-sm text-stone-400 py-4 text-center">Belum ada entry.</p>}
          {graveyard.map(e => (
            <div key={e.id} className="flex items-start gap-3 rounded-xl border border-stone-100 p-3 bg-white hover:border-stone-200 transition-colors">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${TIER_COLOR[e.killTier] ?? 'bg-stone-100 text-stone-600'}`}>{e.killTier}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-stone-800 truncate">{e.adsetName}</p>
                  <span className="text-xs text-stone-400 bg-stone-50 px-1.5 py-0.5 rounded">{e.productKey}</span>
                  {e.killCount > 1 && <span className="text-xs text-red-600 font-medium">⚠ Killed {e.killCount}x</span>}
                </div>
                <p className="text-xs text-stone-500 mt-0.5">{e.killReason}</p>
                <div className="flex gap-3 mt-1 text-xs text-stone-400">
                  <span>Spend: {fmt(e.spendAtKill, 'currency')}</span>
                  {e.catalogROASAtKill != null && <span>CatROAS: {e.catalogROASAtKill.toFixed(2)}</span>}
                  {e.cplcAtKill != null && <span>CPLC: {fmt(e.cplcAtKill, 'currency')}</span>}
                  <span>{new Date(e.lastKilledAt).toLocaleDateString('id-ID')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Diary */}
      {sub === 'diary' && (
        <div className="space-y-2">
          {diary.length === 0 && <p className="text-sm text-stone-400 py-4 text-center">Belum ada diary entry.</p>}
          {diary.map(e => (
            <div key={e.id} className="rounded-xl border border-stone-100 p-4 bg-white">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-sm font-medium text-stone-800">{e.period}</p>
                {e.productKey && <span className="text-xs text-stone-400 bg-stone-50 px-1.5 py-0.5 rounded">{e.productKey}</span>}
              </div>
              <div className="flex gap-4 text-xs text-stone-500 mb-2 flex-wrap">
                {e.killedThisRun != null && <span>Killed: <b className="text-red-600">{e.killedThisRun}</b></span>}
                {e.spawnedThisRun != null && <span>Spawned: <b className="text-green-600">{e.spawnedThisRun}</b></span>}
                {e.avgROAS7d != null && <span>Avg ROAS 7d: <b>{e.avgROAS7d.toFixed(2)}</b></span>}
              </div>
              {e.summaryText && <p className="text-xs text-stone-600 bg-stone-50 rounded-lg p-2">{e.summaryText}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Pain Library */}
      {sub === 'pain' && (
        <div className="space-y-4">
          {/* Add form */}
          <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 space-y-3">
            <p className="text-sm font-medium text-violet-800">Tambah Pain Entry</p>
            <div className="grid grid-cols-2 gap-3">
              <input value={newPain.productKey} onChange={e => setNewPain(p => ({ ...p, productKey: e.target.value }))}
                placeholder="Product key (e.g. lotion)" className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white" />
              <input value={newPain.painText} onChange={e => setNewPain(p => ({ ...p, painText: e.target.value }))}
                placeholder="Pain text" className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white" />
              <input value={newPain.exchangeValues} onChange={e => setNewPain(p => ({ ...p, exchangeValues: e.target.value }))}
                placeholder="Exchange values (comma-separated)" className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white" />
              <input value={newPain.deliveryStyles} onChange={e => setNewPain(p => ({ ...p, deliveryStyles: e.target.value }))}
                placeholder="Delivery styles (comma-separated)" className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white" />
            </div>
            <button onClick={handleAddPain} disabled={saving || !newPain.productKey || !newPain.painText}
              className="text-sm px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Add Pain'}
            </button>
          </div>

          {/* Entries */}
          <div className="space-y-2">
            {pains.map(p => (
              <div key={p.id} className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${p.isActive ? 'border-stone-100 bg-white' : 'border-stone-100 bg-stone-50 opacity-60'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">{p.productKey}</span>
                    {!p.isActive && <span className="text-xs text-stone-400">inactive</span>}
                  </div>
                  <p className="text-sm text-stone-800">{p.painText}</p>
                  <div className="flex gap-3 mt-1 text-xs text-stone-400 flex-wrap">
                    {p.exchangeValues.length > 0 && <span>Exchange: {p.exchangeValues.join(', ')}</span>}
                    {p.deliveryStyles.length > 0 && <span>Delivery: {p.deliveryStyles.join(', ')}</span>}
                  </div>
                </div>
                <button onClick={() => togglePain(p.id, p.isActive)}
                  className={`text-xs px-2 py-1 rounded-lg border transition-colors shrink-0 ${p.isActive ? 'border-stone-200 text-stone-500 hover:bg-stone-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}>
                  {p.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            ))}
            {pains.length === 0 && <p className="text-sm text-stone-400 py-4 text-center">Belum ada pain entry. Tambah di atas.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
