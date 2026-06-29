'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import StatusBadge from '@/components/ui/StatusBadge'
import PageInfo from '@/components/ui/PageInfo'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface MediaAsset {
  id: string
  type: string
  source: string
  publicUrl: string | null
  mimeType: string
  status: string
  productId: string | null
  product: { id: string; name: string } | null
  generationPrompt: string | null
  createdAt: string
  archivedAt: string | null
  _count: { creativeVariants: number }
  // Side detail fields
  primaryText?: string
  headline?: string
  linkUrl?: string
  ctaButton?: string
}

interface Product {
  id: string
  name: string
}

interface CreativeVariant {
  id: string
  name: string
  primaryText: string
  headline: string
  linkUrl: string
  ctaButton: string
  status: string
  usageCount: number
}

interface AssetUsageLaunch {
  id: string
  name: string
  objective: string
  status: string
  creativeCount: number
  creativeStatuses: string[]
}

interface AssetUsageResponse {
  launches: AssetUsageLaunch[]
  totalLaunchUsage: number
  variantCount: number
}

const STATUS_OPTIONS = ['READY', 'DRAFT', 'PROCESSING', 'FAILED', 'ARCHIVED']
const SOURCE_OPTIONS = ['USER_UPLOAD', 'AI_GENERATED']

const inputCls = 'w-full border border-stone-300 dark:border-stone-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 placeholder-stone-400'

export default function MediaLibraryPage() {
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

  // Filters
  const [filterProduct, setFilterProduct] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterType, setFilterType] = useState<'' | 'IMAGE' | 'VIDEO'>('')
  const [filterUnused, setFilterUnused] = useState(false)
  const [search, setSearch] = useState('')

  // Upload modal
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploadName, setUploadName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Generate modal
  const [showGenerate, setShowGenerate] = useState(false)
  const [genProduct, setGenProduct] = useState('')
  const [genPrompt, setGenPrompt] = useState('')
  const [generating, setGenerating] = useState(false)

  // Side detail
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null)
  const [selectedVariants, setSelectedVariants] = useState<CreativeVariant[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [assetUsage, setAssetUsage] = useState<AssetUsageResponse | null>(null)
  const [archiveAssetId, setArchiveAssetId] = useState<string | null>(null)

  const fetchAssets = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterProduct) params.set('productId', filterProduct)
      if (filterStatus) params.set('status', filterStatus)
      if (filterSource) params.set('source', filterSource)
      if (search) params.set('search', search)
      const res = await fetch(`/api/admin/media-assets?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setAssets(data.assets ?? [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [filterProduct, filterStatus, filterSource, search])

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/products?status=active', { credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setProducts(data.products ?? [])
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchAssets() }, [fetchAssets])
  useEffect(() => { fetchProducts() }, [fetchProducts])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setUploadFile(file)
    if (file) {
      setUploadName(file.name.replace(/\.[^.]+$/, ''))
      // Preview hanya untuk image — video cukup nama file
      setUploadPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null)
    } else {
      setUploadPreview(null)
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile) return
    setSaving(true)
    setSaveError(null)
    try {
      // Upload file fisik ke server (Volume) — ad copy diisi nanti saat bikin campaign
      const fd = new FormData()
      fd.append('file', uploadFile)
      fd.append('label', uploadName.trim() || uploadFile.name)
      const res = await fetch('/api/admin/media-assets/upload', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`)
      setShowUpload(false)
      setUploadFile(null)
      setUploadPreview(null)
      setUploadName('')
      await fetchAssets()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!genPrompt.trim()) return
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/media-assets/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId: genProduct || undefined,
          prompt: genPrompt.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`)
      setShowGenerate(false)
      setGenPrompt('')
      setGenProduct('')
      await fetchAssets()
    } catch (err) {
      alert('Generation failed: ' + String(err))
    } finally {
      setGenerating(false)
    }
  }

  const handleArchive = (id: string) => {
    setArchiveAssetId(id)
  }

  const handleArchiveConfirm = async () => {
    if (!archiveAssetId) return
    const id = archiveAssetId
    setArchiveAssetId(null)
    try {
      await fetch(`/api/admin/media-assets/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      await fetchAssets()
      if (selectedAsset?.id === id) setSelectedAsset(null)
    } catch { alert('Failed to archive') }
  }

  const openDetail = async (asset: MediaAsset) => {
    setSelectedAsset(asset)
    setSelectedVariants([])
    setAssetUsage(null)
    setDetailLoading(true)
    try {
      const [detailRes, usageRes] = await Promise.all([
        fetch(`/api/admin/media-assets/${asset.id}`, { credentials: 'include' }),
        fetch(`/api/admin/media-assets/${asset.id}/usage`, { credentials: 'include' }),
      ])
      if (detailRes.ok) {
        const data = await detailRes.json()
        setSelectedAsset(data.asset)
        setSelectedVariants(data.asset.creativeVariants ?? [])
      }
      if (usageRes.ok) {
        const data = await usageRes.json()
        setAssetUsage(data.usage)
      }
    } catch { /* silent */ }
    finally { setDetailLoading(false) }
  }

  const openVariantPage = (assetId: string) => {
    window.location.href = `/media-library/${assetId}`
  }

  // Client-side filters + koleksi per produk
  const visibleAssets = assets.filter(a =>
    (!filterType || a.type === filterType) &&
    (!filterUnused || a._count.creativeVariants === 0)
  )
  const productGroups = (() => {
    const map = new Map<string, { name: string; items: MediaAsset[] }>()
    for (const a of visibleAssets) {
      const key = a.product?.id ?? '__none__'
      const name = a.product?.name ?? 'Tanpa produk'
      if (!map.has(key)) map.set(key, { name, items: [] })
      map.get(key)!.items.push(a)
    }
    // "Tanpa produk" selalu terakhir
    return [...map.entries()].sort(([a], [b]) =>
      a === '__none__' ? 1 : b === '__none__' ? -1 : 0
    )
  })()

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-50">Media Library</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {loading ? '...' : `${assets.length} assets`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowGenerate(true)} className="btn-outline">
            + Generate from Product
          </button>
          <button onClick={() => setShowUpload(true)} className="btn-primary">
            + Upload Asset
          </button>
        </div>
      </div>

      <PageInfo
        purpose="Manage image and video assets for ad creatives. Upload manually or generate via AI."
        inputs={['Image/Video file (upload)', 'Product (optional link)', 'Primary text, headline, link URL, CTA (optional)']}
        wiring={[
          { label: '→ Creative Variants', desc: 'each asset can have multiple text/link variants for A/B testing' },
          { label: '→ Meta Ads', desc: 'assets + variants are used in campaign creatives' },
        ]}
      />

      {/* Toolbar — satu baris: search + chip filter + product + view */}
      <div className="flex flex-wrap gap-2 mb-6 items-center bg-white border border-stone-200 rounded-xl px-3 py-2.5 shadow-sm">
        <div className="relative flex-1 min-w-[160px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">⌕</span>
          <input
            type="text"
            placeholder="Cari label, prompt, produk..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-stone-200 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 bg-stone-50 focus:bg-white transition-colors"
          />
        </div>
        {([['',' Semua'],['IMAGE','Foto'],['VIDEO','Video']] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilterType(val as '' | 'IMAGE' | 'VIDEO')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
              filterType === val
                ? 'bg-violet-100 text-violet-700 border-violet-200'
                : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
            }`}
          >
            {label.trim()}
          </button>
        ))}
        <button
          onClick={() => setFilterStatus(filterStatus === 'READY' ? '' : 'READY')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
            filterStatus === 'READY'
              ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
              : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
          }`}
        >
          READY
        </button>
        <button
          onClick={() => setFilterUnused(v => !v)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
            filterUnused
              ? 'bg-amber-100 text-amber-700 border-amber-200'
              : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
          }`}
        >
          Belum dipakai
        </button>
        <select
          value={filterProduct}
          onChange={e => setFilterProduct(e.target.value)}
          className="border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-600 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 max-w-[150px]"
        >
          <option value="">Semua produk</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select
          value={filterSource}
          onChange={e => setFilterSource(e.target.value)}
          className="border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-600 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        >
          <option value="">Semua sumber</option>
          {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s === 'USER_UPLOAD' ? 'Upload' : 'AI'}</option>)}
        </select>
        <div className="flex rounded-lg border border-stone-200 overflow-hidden">
          {(['grid', 'table'] as const).map(m => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === m ? 'bg-stone-800 text-white' : 'bg-white text-stone-500 hover:bg-stone-50'
              }`}
            >
              {m === 'grid' ? '▦' : '☰'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-stone-400 text-sm">Loading...</div>
      ) : visibleAssets.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-2xl mb-2">🗂</p>
          <p className="text-sm text-stone-500 font-medium mb-1">Belum ada media yang cocok.</p>
          <p className="text-xs text-stone-400 mb-4">Upload manual atau generate dari produk.</p>
          <div className="flex justify-center gap-2">
            <button onClick={() => setShowGenerate(true)} className="btn-outline btn-sm">✨ Generate</button>
            <button onClick={() => setShowUpload(true)} className="btn-primary btn-sm">⬆ Upload</button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="space-y-8">
          {productGroups.map(([groupId, group], gi) => (
            <div key={groupId}>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-bold uppercase tracking-wider text-stone-400">{group.name}</p>
                <span className="text-xs text-stone-300 font-medium">{group.items.length}</span>
                <div className="flex-1 h-px bg-stone-100" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* Kartu Generate — selalu sel pertama grup pertama */}
                {gi === 0 && (
                  <button
                    onClick={() => setShowGenerate(true)}
                    className="aspect-square rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/50 hover:bg-violet-50 hover:border-violet-300 transition-colors flex flex-col items-center justify-center gap-1.5 text-violet-600"
                  >
                    <span className="text-xl">✨</span>
                    <span className="text-xs font-bold">Generate</span>
                    <span className="text-[10px] text-violet-400 font-medium">dari produk</span>
                  </button>
                )}
                {group.items.map(asset => (
                  <div
                    key={asset.id}
                    className="group relative aspect-square rounded-xl overflow-hidden border border-stone-200 hover:border-violet-400 hover:shadow-md transition-all cursor-pointer bg-stone-100"
                    onClick={() => openDetail(asset)}
                  >
                    {asset.publicUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={asset.publicUrl} alt={asset.primaryText ?? asset.generationPrompt ?? 'asset'} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    {/* Badge type video */}
                    {asset.type === 'VIDEO' && (
                      <span className="absolute top-2 right-2 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">▶</span>
                    )}
                    {/* Badge status / usage */}
                    <span className={`absolute bottom-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm ${
                      asset.status === 'READY'
                        ? asset._count.creativeVariants > 0
                          ? 'bg-amber-100/95 text-amber-800'
                          : 'bg-emerald-100/95 text-emerald-700'
                        : asset.status === 'PROCESSING'
                          ? 'bg-violet-100/95 text-violet-700'
                          : 'bg-white/95 text-stone-500'
                    }`}>
                      {asset.status === 'READY'
                        ? asset._count.creativeVariants > 0
                          ? `DIPAKAI ${asset._count.creativeVariants}×`
                          : 'READY'
                        : asset.status}
                    </span>
                    {/* Hover overlay actions */}
                    <div className="absolute inset-x-0 top-0 p-2 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={e => { e.stopPropagation(); handleArchive(asset.id) }}
                        className="bg-white/90 hover:bg-white text-stone-500 hover:text-red-600 text-[10px] font-bold px-2 py-1 rounded-md shadow-sm"
                        title="Arsip"
                      >
                        Arsip
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900">
          <table className="min-w-full text-sm">
            <thead className="bg-stone-50 dark:bg-stone-800">
              <tr>
                {['Preview', 'Primary Text / Prompt', 'Product', 'Status', 'Source', 'Variants', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-stone-600 dark:text-stone-300 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 dark:divide-stone-700">
              {visibleAssets.map(asset => (
                <tr key={asset.id} className="hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer" onClick={() => openDetail(asset)}>
                  <td className="px-4 py-3 w-16">
                    {asset.publicUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={asset.publicUrl} alt="" className="w-12 h-12 object-cover border border-stone-200" />
                    ) : (
                      <div className="w-12 h-12 bg-stone-100 dark:bg-stone-800 border border-stone-200 flex items-center justify-center">
                        <svg className="w-5 h-5 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="font-medium text-stone-800 dark:text-stone-100 truncate">
                      {asset.primaryText ?? asset.generationPrompt ?? '—'}
                    </p>
                    {asset.headline && <p className="text-xs text-stone-500 truncate mt-0.5">{asset.headline}</p>}
                  </td>
                  <td className="px-4 py-3 text-stone-600 dark:text-stone-300 whitespace-nowrap">{asset.product?.name ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={asset.status} /></td>
                  <td className="px-4 py-3 text-stone-500 text-xs">{asset.source}</td>
                  <td className="px-4 py-3 text-stone-600 dark:text-stone-300">{asset._count.creativeVariants}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={e => { e.stopPropagation(); openVariantPage(asset.id) }} className="btn-ghost btn-sm">Variants</button>
                      <button onClick={e => { e.stopPropagation(); handleArchive(asset.id) }} className="btn-ghost btn-sm text-red-600 dark:text-red-400">Archive</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Side Detail Panel */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedAsset(null)} />
          <div className="relative z-10 ml-auto w-full max-w-lg bg-white dark:bg-stone-900 border-l border-stone-300 dark:border-stone-700 shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-stone-800 dark:text-stone-50">Asset Detail</h2>
              <button onClick={() => setSelectedAsset(null)} className="text-stone-400 hover:text-stone-600 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-5">
              {detailLoading ? (
                <div className="text-center py-8 text-stone-400 text-sm">Loading...</div>
              ) : (
                <>
                  {/* Preview */}
                  <div className="aspect-video bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 overflow-hidden">
                    {selectedAsset.publicUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selectedAsset.publicUrl} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-12 h-12 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-stone-500 uppercase">Status</p>
                      <StatusBadge status={selectedAsset.status} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-stone-500 uppercase">Source</p>
                      <p className="text-sm text-stone-700 dark:text-stone-200">{selectedAsset.source}</p>
                    </div>
                    {selectedAsset.product && (
                      <div>
                        <p className="text-xs font-medium text-stone-500 uppercase">Product</p>
                        <p className="text-sm text-stone-700 dark:text-stone-200">{selectedAsset.product.name}</p>
                      </div>
                    )}
                    {selectedAsset.primaryText && (
                      <div>
                        <p className="text-xs font-medium text-stone-500 uppercase">Primary Text</p>
                        <p className="text-sm text-stone-700 dark:text-stone-200">{selectedAsset.primaryText}</p>
                      </div>
                    )}
                    {selectedAsset.headline && (
                      <div>
                        <p className="text-xs font-medium text-stone-500 uppercase">Headline</p>
                        <p className="text-sm text-stone-700 dark:text-stone-200">{selectedAsset.headline}</p>
                      </div>
                    )}
                    {selectedAsset.linkUrl && (
                      <div>
                        <p className="text-xs font-medium text-stone-500 uppercase">Link URL</p>
                        <a href={selectedAsset.linkUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-violet-600 dark:text-violet-400 hover:underline break-all">{selectedAsset.linkUrl}</a>
                      </div>
                    )}
                    {selectedAsset.ctaButton && (
                      <div>
                        <p className="text-xs font-medium text-stone-500 uppercase">CTA Button</p>
                        <p className="text-sm text-stone-700 dark:text-stone-200">{selectedAsset.ctaButton}</p>
                      </div>
                    )}
                    {selectedAsset.generationPrompt && (
                      <div>
                        <p className="text-xs font-medium text-stone-500 uppercase">Generation Prompt</p>
                        <p className="text-sm text-stone-600 dark:text-stone-300">{selectedAsset.generationPrompt}</p>
                      </div>
                    )}
                  </div>

                  {/* Dipakai di */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-stone-700 dark:text-stone-100">
                        Dipakai di ({assetUsage?.launches.length ?? 0})
                      </h3>
                      <span className="text-xs text-stone-400">
                        Variant: {assetUsage?.variantCount ?? selectedVariants.length}
                      </span>
                    </div>
                    {!assetUsage ? (
                      <p className="text-sm text-stone-400">Loading usage...</p>
                    ) : assetUsage.launches.length === 0 ? (
                      <p className="text-sm text-stone-400">Belum dipakai di launch mana pun.</p>
                    ) : (
                      <div className="space-y-3">
                        {assetUsage.launches.map(launch => (
                          <a
                            key={launch.id}
                            href={`/test-launches/${launch.id}`}
                            className="block border border-stone-200 dark:border-stone-700 p-3 hover:border-violet-300 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-3 mb-1">
                              <p className="text-sm font-medium text-stone-800 dark:text-stone-100 truncate">{launch.name}</p>
                              <StatusBadge status={launch.status} />
                            </div>
                            <p className="text-xs text-stone-500">{launch.objective}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-stone-400">
                              <span>{launch.creativeCount} creative match</span>
                              <span>{launch.creativeStatuses.length} status record</span>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Creative Variants */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-stone-700 dark:text-stone-100">
                        Creative Variants ({selectedVariants.length})
                      </h3>
                      <button onClick={() => openVariantPage(selectedAsset.id)} className="btn-outline btn-sm">
                        + Add Variant
                      </button>
                    </div>
                    {selectedVariants.length === 0 ? (
                      <p className="text-sm text-stone-400">No variants yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {selectedVariants.map(v => (
                          <div key={v.id} className="border border-stone-200 dark:border-stone-700 p-3">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-medium text-stone-800 dark:text-stone-100 truncate">{v.primaryText}</p>
                              <StatusBadge status={v.status} />
                            </div>
                            <p className="text-xs text-stone-500 truncate">{v.headline}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs text-stone-400">{v.ctaButton}</span>
                              <span className="text-xs text-stone-400">Used {v.usageCount}x</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <Modal open={showUpload} onClose={() => setShowUpload(false)} title="Upload Asset">
        <form onSubmit={handleUpload} className="space-y-4">
          {/* File picker */}
          <div
            onClick={() => document.getElementById('upload-file-input')?.click()}
            className={`border-2 border-dashed p-6 cursor-pointer text-center transition-colors ${
              uploadPreview ? 'border-violet-300 bg-violet-50 dark:bg-violet-900/20' : 'border-stone-300 hover:border-violet-400'
            }`}
          >
            {uploadFile ? (
              <div className="flex flex-col items-center gap-2">
                {uploadPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={uploadPreview} alt="preview" className="h-24 w-auto object-contain" />
                ) : (
                  <span className="text-3xl">🎬</span>
                )}
                <p className="text-xs text-violet-600 font-medium">{uploadFile.name}</p>
                <p className="text-xs text-stone-400">Klik untuk ganti</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <svg className="w-8 h-8 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-stone-500">Klik untuk upload file</p>
                <p className="text-xs text-stone-400">Image (JPG/PNG/WebP/GIF maks 10MB) · Video (MP4/MOV/WebM maks 200MB)</p>
              </div>
            )}
          </div>
          <input id="upload-file-input" type="file" accept="image/*,video/mp4,video/quicktime,video/webm" onChange={handleFileChange} className="hidden" />

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-200 mb-1">Nama Konten</label>
            <input type="text" value={uploadName} onChange={e => setUploadName(e.target.value)} className={inputCls} placeholder="contoh: Video hook testimoni A" />
            <p className="text-xs text-stone-400 mt-1">
              Primary text, headline, link & CTA diisi nanti saat bikin campaign.
            </p>
          </div>

          {saveError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{saveError}</div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowUpload(false)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving || !uploadFile} className="btn-primary">
              {saving ? 'Saving...' : 'Upload Asset'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Generate Modal */}
      <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Generate from Product">
        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-200 mb-1">Product (optional)</label>
            <select value={genProduct} onChange={e => setGenProduct(e.target.value)} className={inputCls}>
              <option value="">— None —</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-200 mb-1">Generation Prompt <span className="text-red-500">*</span></label>
            <textarea
              value={genPrompt}
              onChange={e => setGenPrompt(e.target.value)}
              required
              rows={4}
              className={`${inputCls} resize-none`}
              placeholder="Describe the image you want to generate..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowGenerate(false)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={generating || !genPrompt.trim()} className="btn-primary">
              {generating ? 'Generating...' : 'Generate Image'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={archiveAssetId !== null}
        title="Archive Asset"
        body={<p>Archive this asset? It will no longer appear in active media.</p>}
        confirmLabel="Archive"
        danger
        onConfirm={handleArchiveConfirm}
        onCancel={() => setArchiveAssetId(null)}
      />
    </div>
  )
}
