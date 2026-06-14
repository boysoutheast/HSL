'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

/* ── types ── */
interface IgAccount { id: string; username: string; accountName: string | null }
interface PhotoRef { id: string; fileUrl: string; label: string }
interface MediaAssetItem { id: string; fileUrl: string | null; publicUrl: string | null; label: string | null }
interface Product { id: string; name: string; _count?: { photoReferences: number } }
interface VideoJob {
  id: string; prompt: string; status: string
  videoUrl?: string | null; thumbnailUrl?: string | null; errorMessage?: string | null
  instagramAccountId?: string | null; createdAt: string; completedAt?: string | null
  durationSeconds?: number | null; orientation?: string | null; creditsCost?: number | null
  inputs?: { photoReference: { id: string; fileUrl: string; label: string } }[]
}

interface Asset {
  id: string
  type: 'photo' | 'product' | 'account' | 'media-asset'
  label: string
  thumbnailUrl?: string
  sourceId: string
}

/* ── constants ── */
const ORIENTATIONS = [
  { id: '16:9', label: 'Landscape', sub: '16:9' },
  { id: '9:16', label: 'Portrait', sub: '9:16' },
  { id: '1:1', label: 'Square', sub: '1:1' },
  { id: '2:3', label: 'Vertical', sub: '2:3' },
  { id: '3:2', label: 'Horizontal', sub: '3:2' },
] as const

const STATUS_LABEL: Record<string, string> = {
  queued: 'Antrian', processing: 'Proses', ready_for_rehost: 'Rehosting',
  completed: 'Selesai', failed: 'Gagal',
}
const STATUS_CLS: Record<string, string> = {
  queued: 'bg-amber-100 text-amber-700', processing: 'bg-blue-100 text-blue-700',
  ready_for_rehost: 'bg-cyan-100 text-cyan-700', completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
}

function fmtDate(s: string) {
  return new Date(s).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function getCost(duration: number) {
  return duration === 6 ? 1000 : 1300
}

/* ── component ── */
export default function GenerateVideoPage() {
  /* state */
  const [assets, setAssets] = useState<Asset[]>([])
  const [prompt, setPrompt] = useState('')
  const [orientation, setOrientation] = useState('9:16')
  const [duration, setDuration] = useState<6 | 10>(6)
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  /* picker state */
  const [showPicker, setShowPicker] = useState(false)
  const [pickerTab, setPickerTab] = useState<'account' | 'library' | 'product'>('library')
  const [pickerAccounts, setPickerAccounts] = useState<IgAccount[]>([])
  const [pickerPhotos, setPickerPhotos] = useState<PhotoRef[]>([])
  const [pickerMediaAssets, setPickerMediaAssets] = useState<MediaAssetItem[]>([])
  const [pickerProducts, setPickerProducts] = useState<Product[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerError, setPickerError] = useState('')

  /* history */
  const [jobs, setJobs] = useState<VideoJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const [fullscreenJob, setFullscreenJob] = useState<VideoJob | null>(null)
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set())

  /* textarea ref for @mention insert */
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  /* ── load credits on mount ── */
  useEffect(() => {
    fetch('/api/admin/connections/credits', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setCreditBalance(d.creditBalance ?? 0) })
      .catch(() => {})
  }, [])

  /* ── history ── */
  const fetchJobs = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/generate/video?limit=30', { credentials: 'include' })
      if (!r.ok) throw new Error()
      const d = await r.json()
      setJobs(d.items ?? [])
    } catch { /* silent */ } finally {
      setLoadingJobs(false)
    }
  }, [])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    const hasActive = jobs.some(j => ['queued', 'processing', 'ready_for_rehost'].includes(j.status))
    if (hasActive) pollRef.current = setInterval(fetchJobs, 12000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [jobs, fetchJobs])

  /* ── load picker data when opened ── */
  useEffect(() => {
    if (!showPicker) return
    setPickerError('')
    setPickerLoading(true)

    const fetches: Promise<void>[] = []

    fetches.push(
      fetch('/api/admin/accounts', { credentials: 'include' })
        .then(r => r.ok ? r.json() : { accounts: [] })
        .then(d => setPickerAccounts(d.accounts ?? []))
        .catch(() => setPickerAccounts([]))
    )

    fetches.push(
      fetch('/api/admin/products', { credentials: 'include' })
        .then(r => r.ok ? r.json() : { products: [] })
        .then(d => setPickerProducts(d.products ?? []))
        .catch(() => setPickerProducts([]))
    )

    // photos: fetch all active photoReferences
    fetches.push(
      fetch('/api/admin/photos?status=active', { credentials: 'include' })
        .then(r => r.ok ? r.json() : { photos: [] })
        .then(d => setPickerPhotos(d.photos ?? []))
        .catch(() => setPickerPhotos([]))
    )

    // media assets: uploaded images from Library
    fetches.push(
      fetch('/api/admin/media-assets?type=IMAGE&status=READY', { credentials: 'include' })
        .then(r => r.ok ? r.json() : { assets: [] })
        .then(d => setPickerMediaAssets(d.assets ?? []))
        .catch(() => setPickerMediaAssets([]))
    )

    Promise.all(fetches).finally(() => setPickerLoading(false))
  }, [showPicker])

  /* ── asset actions ── */
  function addAsset(asset: Asset) {
    setAssets(prev => {
      if (prev.length >= 5) return prev
      return [...prev, asset]
    })
    setShowPicker(false)
  }

  function removeAsset(index: number) {
    setAssets(prev => prev.filter((_, i) => i !== index))
  }

  function insertMention(index: number) {
    const ta = textareaRef.current
    if (!ta) return
    const mention = `@image${index + 1}`
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const before = prompt.slice(0, start)
    const after = prompt.slice(end)
    const needsLeadingSpace = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n')
    const insertion = needsLeadingSpace ? ` ${mention}` : mention
    setPrompt(before + insertion + after)
    // restore cursor after mention
    requestAnimationFrame(() => {
      const newPos = start + insertion.length
      ta.setSelectionRange(newPos, newPos)
      ta.focus()
    })
  }

  /* ── submit ── */
  const handleSubmit = async () => {
    setError('')
    if (!prompt.trim()) { setError('Prompt wajib diisi.'); return }

    const cost = getCost(duration)
    if (creditBalance != null && creditBalance < cost) {
      setError('Saldo tidak cukup.')
      return
    }

    // Resolve product assets → fetch their photo references
    const productAssetIds = assets.filter(a => a.type === 'product').map(a => a.sourceId)
    let resolvedProductPhotoIds: string[] = []
    if (productAssetIds.length > 0) {
      try {
        const productPhotos = await Promise.all(
          productAssetIds.map(async (pid) => {
            const r = await fetch(`/api/admin/photos?productId=${pid}&status=active`, { credentials: 'include' })
            if (!r.ok) return []
            const d = await r.json()
            return (d.photos ?? []) as PhotoRef[]
          })
        )
        // take first photo per product, flatten
        resolvedProductPhotoIds = productPhotos
          .filter(arr => arr.length > 0)
          .map(arr => arr[0].id)
      } catch {
        setError('Gagal mengambil foto produk.')
        return
      }
    }

    const photoAssetIds = assets.filter(a => a.type === 'photo').map(a => a.sourceId)
    const mediaAssetIds = assets.filter(a => a.type === 'media-asset').map(a => a.sourceId)
    const allPhotoRefIds = [...photoAssetIds, ...resolvedProductPhotoIds]
    const accountAsset = assets.find(a => a.type === 'account')

    const payload = {
      prompt: prompt.trim(),
      instagramAccountId: accountAsset?.sourceId ?? undefined,
      photoReferenceIds: allPhotoRefIds,
      mediaAssetIds,
      orientation,
      durationSeconds: duration,
    }

    setSubmitting(true)
    try {
      const r = await fetch('/api/admin/generate/video', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error ?? 'Gagal submit'); return }
      // clear form
      setPrompt('')
      setAssets([])
      await fetchJobs()
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── computed ── */
  const cost = getCost(duration)
  const balanceAfter = creditBalance != null ? creditBalance - cost : null
  const insufficientBalance = creditBalance != null && creditBalance < cost
  const canSubmit = prompt.trim().length > 0 && !insufficientBalance && !submitting

  /* parse which @imageN are in prompt for chip highlighting */
  const mentionedIndices = new Set<number>()
  const mentionRe = /@image(\d+)/g
  let m: RegExpExecArray | null
  while ((m = mentionRe.exec(prompt)) !== null) {
    const idx = parseInt(m[1], 10) - 1
    if (idx >= 0 && idx < assets.length) mentionedIndices.add(idx)
  }

  return (
    <div className="space-y-6">
      {/* ── Form ── */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5">
        <h3 className="text-base font-semibold text-stone-800">Generate Video</h3>

        {/* PROMPT */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">Prompt</p>
          <textarea
            ref={textareaRef}
            className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm text-stone-800 resize-none h-28 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent"
            placeholder="Deskripsikan video. Klik chip @image di bawah untuk menambah referensi."
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
          />

          {/* Asset chips */}
          {assets.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-stone-400 mr-1">Referensi:</span>
              {assets.map((a, i) => {
                const mentioned = mentionedIndices.has(i)
                return (
                  <span key={a.id} className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => insertMention(i)}
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border transition cursor-pointer ${
                        mentioned
                          ? 'bg-violet-100 text-violet-700 border-violet-300'
                          : 'bg-stone-50 text-stone-600 border-stone-200 hover:border-violet-300'
                      }`}
                    >
                      {a.thumbnailUrl && (
                        <img src={a.thumbnailUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
                      )}
                      @image{i + 1}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAsset(i)}
                      className="text-stone-300 hover:text-red-400 transition text-xs leading-none"
                      title="Hapus referensi"
                    >
                      ✕
                    </button>
                  </span>
                )
              })}
            </div>
          )}

          {/* Add Asset button */}
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            disabled={assets.length >= 5}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-800 disabled:text-stone-300 disabled:cursor-not-allowed transition-colors"
          >
            <span className="text-base leading-none">+</span> Add Asset
          </button>
          {assets.length >= 5 && (
            <span className="ml-2 text-[11px] text-stone-400">Maks 5 asset</span>
          )}
        </div>

        {/* ORIENTATION */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">Orientation</p>
          <div className="flex flex-wrap gap-2">
            {ORIENTATIONS.map(o => (
              <button
                key={o.id}
                type="button"
                onClick={() => setOrientation(o.id)}
                className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 text-xs transition ${
                  orientation === o.id
                    ? 'border-violet-500 bg-violet-50 text-violet-700'
                    : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300'
                }`}
              >
                {/* aspect ratio icon */}
                <span className="block border border-current rounded" style={{
                  width: o.id === '9:16' ? 16 : o.id === '16:9' ? 28 : o.id === '2:3' ? 14 : o.id === '3:2' ? 22 : 20,
                  height: o.id === '9:16' ? 28 : o.id === '16:9' ? 16 : o.id === '2:3' ? 22 : o.id === '3:2' ? 14 : 20,
                }} />
                <span className="font-semibold">{o.label}</span>
                <span className="text-[10px] text-stone-400">{o.sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* DURATION */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">Duration</p>
          <div className="flex gap-2">
            {([6, 10] as const).map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                className={`px-4 py-2 rounded-xl border text-sm font-medium transition ${
                  duration === d
                    ? 'border-violet-500 bg-violet-50 text-violet-700'
                    : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300'
                }`}
              >
                {d} detik
              </button>
            ))}
          </div>
        </div>

        {/* SALDO & BIAYA */}
        {creditBalance != null && (
          <div className={`rounded-xl px-4 py-3 text-sm ${insufficientBalance ? 'bg-red-50 border border-red-200' : 'bg-stone-50'}`}>
            <span className="text-stone-500">Saldo: </span>
            <span className="font-semibold text-stone-800">{creditBalance.toLocaleString('id-ID')} credits</span>
            <span className="mx-2 text-stone-300">·</span>
            <span className="text-stone-500">Generate ini: </span>
            <span className="font-semibold text-stone-800">{cost.toLocaleString('id-ID')} credits</span>
            {balanceAfter != null && (
              <>
                <span className="mx-2 text-stone-300">·</span>
                <span className="text-stone-500">Sisa: </span>
                <span className={`font-semibold ${balanceAfter < 0 ? 'text-red-600' : 'text-stone-800'}`}>
                  {balanceAfter.toLocaleString('id-ID')} credits
                </span>
              </>
            )}
            {insufficientBalance && (
              <p className="text-red-600 text-xs mt-1">⚠️ Saldo tidak cukup untuk generate video.</p>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3.5 py-2">{error}</p>
        )}

        {/* SUBMIT */}
        <div className="flex justify-end">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="px-6 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Mengirim...' : 'Generate Video →'}
          </button>
        </div>
      </div>

      {/* ── Asset Picker Modal ── */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/40" onClick={() => setShowPicker(false)}>
          <div
            className="bg-white rounded-2xl shadow-xl border border-stone-200 w-full max-w-lg mx-4 max-h-[70vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* tabs */}
            <div className="flex border-b border-stone-200 px-4 pt-4 gap-1">
              {([
                ['account', 'Akun'],
                ['library', 'Library'],
                ['product', 'Produk'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPickerTab(key)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
                    pickerTab === key
                      ? 'bg-white text-violet-700 border-b-2 border-violet-500 -mb-[1px]'
                      : 'text-stone-400 hover:text-stone-600'
                  }`}
                >
                  {label}
                </button>
              ))}
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="text-stone-400 hover:text-stone-600 text-lg leading-none px-2"
              >
                ✕
              </button>
            </div>

            {/* tab content */}
            <div className="p-4 overflow-y-auto flex-1">
              {pickerLoading ? (
                <p className="text-sm text-stone-400 py-8 text-center">Memuat...</p>
              ) : pickerError ? (
                <div className="text-center py-8">
                  <p className="text-sm text-red-500 mb-2">{pickerError}</p>
                  <button
                    type="button"
                    onClick={() => { setShowPicker(false); setTimeout(() => setShowPicker(true), 100) }}
                    className="text-xs text-violet-600 hover:underline"
                  >
                    Coba lagi
                  </button>
                </div>
              ) : pickerTab === 'account' ? (
                pickerAccounts.length === 0 ? (
                  <p className="text-sm text-stone-400 py-8 text-center">Belum ada akun.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {pickerAccounts.map(acc => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => addAsset({ id: `acc-${acc.id}`, type: 'account', label: `@${acc.username}`, sourceId: acc.id })}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-stone-200 hover:border-violet-300 text-left transition"
                      >
                        <span className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-bold shrink-0">
                          {acc.username.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-stone-700 truncate">@{acc.username}</p>
                          {acc.accountName && <p className="text-[11px] text-stone-400 truncate">{acc.accountName}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )
              ) : pickerTab === 'library' ? (
                pickerPhotos.length === 0 && pickerMediaAssets.length === 0 ? (
                  <p className="text-sm text-stone-400 py-8 text-center">Belum ada foto.</p>
                ) : (
                  <div className="space-y-3">
                    {pickerMediaAssets.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">Upload</p>
                        <div className="grid grid-cols-4 gap-2">
                          {pickerMediaAssets.map(ma => {
                            const url = ma.fileUrl ?? ma.publicUrl ?? ''
                            return (
                              <button
                                key={ma.id}
                                type="button"
                                onClick={() => addAsset({ id: `ma-${ma.id}`, type: 'media-asset', label: ma.label ?? ma.id, thumbnailUrl: url, sourceId: ma.id })}
                                className="aspect-square rounded-xl overflow-hidden border-2 border-stone-200 hover:border-violet-400 transition"
                              >
                                <img src={url} alt={ma.label ?? ''} className="w-full h-full object-cover" />
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    {pickerPhotos.length > 0 && (
                      <div>
                        {pickerMediaAssets.length > 0 && <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">Assigned Photos</p>}
                        <div className="grid grid-cols-4 gap-2">
                          {pickerPhotos.map(photo => (
                            <button
                              key={photo.id}
                              type="button"
                              onClick={() => addAsset({ id: `photo-${photo.id}`, type: 'photo', label: photo.label, thumbnailUrl: photo.fileUrl, sourceId: photo.id })}
                              className="aspect-square rounded-xl overflow-hidden border-2 border-stone-200 hover:border-violet-400 transition"
                            >
                              <img src={photo.fileUrl} alt={photo.label} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              ) : (
                /* product tab */
                pickerProducts.length === 0 ? (
                  <p className="text-sm text-stone-400 py-8 text-center">Belum ada produk.</p>
                ) : (
                  <div className="space-y-1">
                    {pickerProducts.map(prod => {
                      const photoCount = prod._count?.photoReferences ?? 0
                      return (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => addAsset({ id: `prod-${prod.id}`, type: 'product', label: prod.name, sourceId: prod.id })}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-stone-200 hover:border-violet-300 text-left transition"
                        >
                          <span className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                            <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-stone-700 truncate">{prod.name}</p>
                            <p className="text-[11px] text-stone-400">{photoCount} foto</p>
                          </div>
                          <span className="text-violet-400 text-sm">+</span>
                        </button>
                      )
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── History ── */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-stone-800">Riwayat</h3>
          <span className="text-xs text-stone-400">{jobs.length} job</span>
        </div>
        {loadingJobs ? (
          <p className="text-sm text-stone-400 py-4">Memuat...</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-stone-400 py-4">Belum ada job.</p>
        ) : (
          <div className="space-y-3">
            {jobs.map(job => {
              const isExpanded = expandedPrompts.has(job.id)
              const promptLong = job.prompt.length > 120
              return (
                <div key={job.id} className="border border-stone-100 rounded-2xl overflow-hidden hover:border-stone-200 transition">
                  {/* video / thumbnail row */}
                  {job.status === 'completed' && job.videoUrl ? (
                    <div className="relative bg-black group cursor-pointer" onClick={() => setFullscreenJob(job)}>
                      <video
                        src={job.videoUrl}
                        className="w-full max-h-64 object-contain"
                        preload="metadata"
                      />
                      {/* play overlay */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition">
                        <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                          <svg className="w-6 h-6 text-stone-800 ml-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </div>
                      </div>
                      {/* fullscreen hint */}
                      <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition">
                        Tap untuk fullscreen
                      </div>
                    </div>
                  ) : job.status === 'processing' || job.status === 'queued' ? (
                    <div className="w-full h-20 bg-stone-50 flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 text-violet-400 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      <span className="text-sm text-stone-400">Sedang diproses...</span>
                    </div>
                  ) : job.status === 'failed' ? (
                    <div className="w-full h-20 bg-red-50 flex items-center justify-center">
                      <span className="text-sm text-red-400">Gagal generate</span>
                    </div>
                  ) : null}

                  {/* metadata */}
                  <div className="p-4 space-y-2">
                    {/* status + tanggal + meta */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_CLS[job.status] ?? 'bg-stone-100 text-stone-500'}`}>
                        {STATUS_LABEL[job.status] ?? job.status}
                      </span>
                      <span className="text-xs text-stone-400">{fmtDate(job.createdAt)}</span>
                      {job.durationSeconds && (
                        <span className="text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{job.durationSeconds}s</span>
                      )}
                      {job.orientation && (
                        <span className="text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{job.orientation}</span>
                      )}
                      {job.creditsCost && (
                        <span className="text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{job.creditsCost.toLocaleString('id-ID')} cr</span>
                      )}
                      {job.completedAt && (
                        <span className="text-[10px] text-stone-400">selesai {fmtDate(job.completedAt)}</span>
                      )}
                    </div>

                    {/* prompt */}
                    <div>
                      <p className={`text-sm text-stone-700 ${!isExpanded && promptLong ? 'line-clamp-2' : ''}`}>
                        {job.prompt}
                      </p>
                      {promptLong && (
                        <button
                          type="button"
                          onClick={() => setExpandedPrompts(prev => {
                            const next = new Set(prev)
                            next.has(job.id) ? next.delete(job.id) : next.add(job.id)
                            return next
                          })}
                          className="text-[11px] text-violet-500 hover:text-violet-700 mt-0.5"
                        >
                          {isExpanded ? 'Sembunyikan' : 'Lihat selengkapnya'}
                        </button>
                      )}
                    </div>

                    {/* error */}
                    {job.status === 'failed' && job.errorMessage && (
                      <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{job.errorMessage}</p>
                    )}

                    {/* ref photos */}
                    {job.inputs && job.inputs.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-stone-400">Ref:</span>
                        {job.inputs.slice(0, 5).map(inp => (
                          <img
                            key={inp.photoReference.id}
                            src={inp.photoReference.fileUrl}
                            alt={inp.photoReference.label}
                            className="w-7 h-7 rounded-lg object-cover border border-stone-200"
                            title={inp.photoReference.label}
                          />
                        ))}
                      </div>
                    )}

                    {/* actions */}
                    {job.status === 'completed' && job.videoUrl && (
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setFullscreenJob(job)}
                          className="flex-1 text-xs px-3 py-2 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 transition"
                        >
                          ▶ Putar
                        </button>
                        <a
                          href={job.videoUrl}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-3 py-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 transition"
                        >
                          Download
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Fullscreen Video Modal ── */}
      {fullscreenJob && fullscreenJob.videoUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col"
          onClick={() => setFullscreenJob(null)}
        >
          {/* header */}
          <div className="flex items-center justify-between px-6 py-4 shrink-0" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 min-w-0">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUS_CLS[fullscreenJob.status] ?? ''}`}>
                {STATUS_LABEL[fullscreenJob.status]}
              </span>
              <span className="text-white/60 text-xs">{fmtDate(fullscreenJob.createdAt)}</span>
              {fullscreenJob.durationSeconds && <span className="text-white/40 text-xs">{fullscreenJob.durationSeconds}s</span>}
            </div>
            <button
              type="button"
              onClick={() => setFullscreenJob(null)}
              className="text-white/60 hover:text-white text-2xl leading-none ml-4 shrink-0"
            >
              ✕
            </button>
          </div>

          {/* video */}
          <div className="flex-1 flex items-center justify-center px-4" onClick={e => e.stopPropagation()}>
            <video
              src={fullscreenJob.videoUrl}
              controls
              autoPlay
              className="max-w-full max-h-full rounded-xl"
              style={{ maxHeight: 'calc(100vh - 220px)' }}
            />
          </div>

          {/* footer: prompt + download */}
          <div className="px-6 py-4 shrink-0" onClick={e => e.stopPropagation()}>
            <p className="text-white/80 text-sm mb-3 line-clamp-3">{fullscreenJob.prompt}</p>
            <div className="flex gap-3">
              <a
                href={fullscreenJob.videoUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm px-4 py-2 rounded-xl bg-white text-stone-800 font-medium hover:bg-stone-100 transition"
              >
                Download
              </a>
              {fullscreenJob.creditsCost && (
                <span className="text-xs text-white/40 self-center">{fullscreenJob.creditsCost.toLocaleString('id-ID')} credits</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
