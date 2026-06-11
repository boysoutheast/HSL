'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import StatusBadge from '@/components/ui/StatusBadge'
import PageInfo from '@/components/ui/PageInfo'
import Modal from '@/components/ui/Modal'

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

  const handleArchive = async (id: string) => {
    if (!confirm('Archive this asset?')) return
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
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/admin/media-assets/${asset.id}`, { credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSelectedAsset(data.asset)
      setSelectedVariants(data.asset.creativeVariants ?? [])
    } catch { /* silent */ }
    finally { setDetailLoading(false) }
  }

  const openVariantPage = (assetId: string) => {
    window.location.href = `/media-library/${assetId}`
  }

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

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={`${inputCls} w-48`}
        />
        <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)} className={inputCls + ' w-48'}>
          <option value="">All Products</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={inputCls + ' w-40'}>
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className={inputCls + ' w-40'}>
          <option value="">All Sources</option>
          {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`btn-ghost btn-sm ${viewMode === 'grid' ? 'border-violet-500 text-violet-700 dark:text-violet-300' : ''}`}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`btn-ghost btn-sm ${viewMode === 'table' ? 'border-violet-500 text-violet-700 dark:text-violet-300' : ''}`}
          >
            Table
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-stone-400 text-sm">Loading...</div>
      ) : assets.length === 0 ? (
        <div className="text-center py-16 text-stone-400 text-sm">No assets found.</div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {assets.map(asset => (
            <div
              key={asset.id}
              className="card-hover cursor-pointer overflow-hidden"
              onClick={() => openDetail(asset)}
            >
              {/* Image */}
              <div className="aspect-square bg-stone-100 dark:bg-stone-800 overflow-hidden border-b border-stone-200 dark:border-stone-700">
                {asset.publicUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.publicUrl} alt={asset.primaryText ?? asset.generationPrompt ?? 'asset'} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-10 h-10 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
              {/* Card body */}
              <div className="p-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-medium text-stone-800 dark:text-stone-100 truncate">
                    {asset.primaryText ?? asset.generationPrompt ?? asset.id.slice(0, 8)}
                  </p>
                  <StatusBadge status={asset.status} />
                </div>
                {asset.product && (
                  <p className="text-xs text-stone-500 mb-1 truncate">{asset.product.name}</p>
                )}
                <p className="text-xs text-stone-400 mb-3">{asset._count.creativeVariants} variant{asset._count.creativeVariants !== 1 ? 's' : ''}</p>
                <div className="flex gap-2">
                  <button
                    onClick={e => { e.stopPropagation(); openVariantPage(asset.id) }}
                    className="btn-ghost btn-sm flex-1"
                  >
                    View Variants
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); handleArchive(asset.id) }}
                    className="btn-ghost btn-sm text-red-600 dark:text-red-400"
                  >
                    Archive
                  </button>
                </div>
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
              {assets.map(asset => (
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
    </div>
  )
}
