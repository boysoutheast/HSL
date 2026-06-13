'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
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
  primaryText?: string
  headline?: string
  linkUrl?: string
  ctaButton?: string
  creativeVariants: CreativeVariant[]
}

interface CreativeVariant {
  id: string
  name: string
  primaryText: string
  headline: string
  description: string | null
  linkUrl: string
  ctaButton: string
  status: string
  usageCount: number
  createdAt: string
}

interface Product {
  id: string
  name: string
}

const CTA_OPTIONS = ['LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'DOWNLOAD', 'GET_QUOTE', 'CONTACT_US', 'BOOK_NOW', 'WATCH_MORE']

const inputCls = 'w-full border border-stone-300 dark:border-stone-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50'

export default function MediaAssetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [asset, setAsset] = useState<MediaAsset | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add variant modal
  const [showAddVariant, setShowAddVariant] = useState(false)
  const [variantForm, setVariantForm] = useState({
    name: '',
    primaryText: '',
    headline: '',
    description: '',
    linkUrl: '',
    ctaButton: 'LEARN_MORE',
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const fetchAsset = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/media-assets/${id}`, { credentials: 'include' })
      if (!res.ok) {
        if (res.status === 404) setError('Asset not found')
        else setError('Failed to load asset')
        return
      }
      const data = await res.json()
      setAsset(data.asset)
    } catch {
      setError('Failed to load asset')
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/products?status=active', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setProducts(data.products ?? [])
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchAsset() }, [fetchAsset])
  useEffect(() => { fetchProducts() }, [fetchProducts])

  const handleStatusChange = async (newStatus: string) => {
    if (!asset) return
    if (!confirm(`Change status to "${newStatus}"?`)) return
    try {
      const res = await fetch(`/api/admin/media-assets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error()
      await fetchAsset()
    } catch {
      alert('Failed to update status')
    }
  }

  const handleArchive = async () => {
    if (!asset) return
    if (!confirm('Archive this asset?')) return
    try {
      await fetch(`/api/admin/media-assets/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      window.location.href = '/media-library'
    } catch {
      alert('Failed to archive asset')
    }
  }

  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!asset || !variantForm.primaryText.trim() || !variantForm.headline.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/admin/creative-variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId: asset.productId ?? products[0]?.id ?? '',
          mediaAssetId: asset.id,
          name: variantForm.name || `Variant ${Date.now()}`,
          primaryText: variantForm.primaryText.trim(),
          headline: variantForm.headline.trim(),
          description: variantForm.description.trim() || undefined,
          linkUrl: variantForm.linkUrl.trim() || 'https://',
          ctaButton: variantForm.ctaButton,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Failed to add variant')
      setShowAddVariant(false)
      setVariantForm({ name: '', primaryText: '', headline: '', description: '', linkUrl: '', ctaButton: 'LEARN_MORE' })
      await fetchAsset()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to add variant')
    } finally {
      setSaving(false)
    }
  }

  const handleArchiveVariant = async (variantId: string) => {
    if (!confirm('Archive this variant?')) return
    try {
      await fetch(`/api/admin/creative-variants/${variantId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      await fetchAsset()
    } catch {
      alert('Failed to archive variant')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-stone-400 text-sm">Loading...</div>
    )
  }

  if (error || !asset) {
    return (
      <div className="text-center py-16">
        <p className="text-stone-400 text-sm">{error ?? 'Asset not found'}</p>
        <Link href="/media?tab=library" className="btn-ghost btn-sm mt-4 inline-block">← Back to Media Library</Link>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/media?tab=library" className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-50">
              {asset.primaryText ?? asset.generationPrompt ?? 'Asset Detail'}
            </h1>
            <p className="text-sm text-stone-500 mt-0.5">
              Created {new Date(asset.createdAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {asset.status === 'DRAFT' && (
            <button onClick={() => handleStatusChange('READY')} className="btn-success btn-sm">
              Mark Ready
            </button>
          )}
          {asset.status !== 'ARCHIVED' && (
            <button onClick={handleArchive} className="btn-danger btn-sm">
              Archive Asset
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Asset info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card p-0 overflow-hidden">
            {/* Preview */}
            <div className="aspect-square bg-stone-100 dark:bg-stone-800">
              {asset.publicUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={asset.publicUrl} alt="" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-16 h-16 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            {/* Info */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-stone-500 uppercase">Status</span>
                <StatusBadge status={asset.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-stone-500 uppercase">Type</span>
                <span className="text-sm text-stone-700 dark:text-stone-200">{asset.type}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-stone-500 uppercase">Source</span>
                <span className="text-sm text-stone-700 dark:text-stone-200">{asset.source}</span>
              </div>
              {asset.product && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-stone-500 uppercase">Product</span>
                  <span className="text-sm text-stone-700 dark:text-stone-200">{asset.product.name}</span>
                </div>
              )}
              {asset.mimeType && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-stone-500 uppercase">MIME</span>
                  <span className="text-sm text-stone-600 dark:text-stone-300">{asset.mimeType}</span>
                </div>
              )}
              {asset.generationPrompt && (
                <div>
                  <p className="text-xs font-medium text-stone-500 uppercase mb-1">Generation Prompt</p>
                  <p className="text-sm text-stone-600 dark:text-stone-300">{asset.generationPrompt}</p>
                </div>
              )}
            </div>
          </div>

          <PageInfo
            purpose="Asset detail view. Each asset can have multiple creative text/link variants."
            inputs={['+ Add Creative Variant form below']}
            wiring={[
              { label: '→ Meta Ads', desc: 'variants are used as ad creatives' },
            ]}
          />
        </div>

        {/* Right: Creative Variants */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-50">
              Creative Variants ({asset.creativeVariants?.length ?? 0})
            </h2>
            <button onClick={() => setShowAddVariant(true)} className="btn-primary btn-sm">
              + Add Creative Variant
            </button>
          </div>

          {(!asset.creativeVariants || asset.creativeVariants.length === 0) ? (
            <div className="text-center py-12 border border-dashed border-stone-300 dark:border-stone-700">
              <p className="text-stone-400 text-sm mb-3">No creative variants yet.</p>
              <button onClick={() => setShowAddVariant(true)} className="btn-outline btn-sm">
                + Add First Variant
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {asset.creativeVariants.map(variant => (
                <div key={variant.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-stone-800 dark:text-stone-100 mb-1">{variant.primaryText}</p>
                      <p className="text-sm text-stone-500 mb-2">{variant.headline}</p>
                      {variant.description && (
                        <p className="text-xs text-stone-400 mb-2">{variant.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-stone-400">
                        <span className="bg-stone-100 dark:bg-stone-800 px-2 py-0.5 border border-stone-200 dark:border-stone-700">{variant.ctaButton}</span>
                        {variant.linkUrl && (
                          <a href={variant.linkUrl} target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 hover:underline truncate max-w-xs">
                            {variant.linkUrl}
                          </a>
                        )}
                        <span>Used {variant.usageCount}x</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={variant.status} />
                      <button
                        onClick={() => handleArchiveVariant(variant.id)}
                        className="btn-ghost btn-sm text-red-600 dark:text-red-400"
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Variant Modal */}
      <Modal open={showAddVariant} onClose={() => setShowAddVariant(false)} title="Add Creative Variant">
        <form onSubmit={handleAddVariant} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-200 mb-1">
              Primary Text <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={variantForm.primaryText}
              onChange={e => setVariantForm({ ...variantForm, primaryText: e.target.value })}
              required
              maxLength={125}
              className={inputCls}
              placeholder="Main body text (max 125 chars)"
            />
            <p className="text-xs text-stone-400 mt-0.5 text-right">{variantForm.primaryText.length}/125</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-200 mb-1">
              Headline <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={variantForm.headline}
              onChange={e => setVariantForm({ ...variantForm, headline: e.target.value })}
              required
              maxLength={255}
              className={inputCls}
              placeholder="Short headline (max 255 chars)"
            />
            <p className="text-xs text-stone-400 mt-0.5 text-right">{variantForm.headline.length}/255</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-200 mb-1">Link URL</label>
            <input
              type="url"
              value={variantForm.linkUrl}
              onChange={e => setVariantForm({ ...variantForm, linkUrl: e.target.value })}
              className={inputCls}
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-200 mb-1">CTA Button</label>
            <select
              value={variantForm.ctaButton}
              onChange={e => setVariantForm({ ...variantForm, ctaButton: e.target.value })}
              className={inputCls}
            >
              {CTA_OPTIONS.map(c => (
                <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-200 mb-1">Description</label>
            <textarea
              value={variantForm.description}
              onChange={e => setVariantForm({ ...variantForm, description: e.target.value })}
              rows={2}
              className={`${inputCls} resize-none`}
              placeholder="Optional description..."
            />
          </div>

          {saveError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{saveError}</div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowAddVariant(false)} className="btn-ghost">Cancel</button>
            <button
              type="submit"
              disabled={saving || !variantForm.primaryText.trim() || !variantForm.headline.trim()}
              className="btn-primary"
            >
              {saving ? 'Saving...' : 'Add Variant'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
