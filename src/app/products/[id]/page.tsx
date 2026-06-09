'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import StatusBadge from '@/components/ui/StatusBadge'
import PageInfo from '@/components/ui/PageInfo'
import Modal from '@/components/ui/Modal'
import PhotoLightbox from '@/components/PhotoLightbox'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string
  name: string
  description: string | null
  mainBenefit: string | null
  shopeeUrl: string | null
  price: string | null
  ingredients: string | null
  usageInstruction: string | null
  notes: string | null
  status: string
}

interface Photo {
  id: string
  fileUrl: string
  label: string
  category: string | null
  status: string
  createdAt: string
}

interface Cep {
  id: string
  cepText: string
  painPoint: string | null
  angle: string | null
  source: string
  status: string
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'
const textareaCls = `${inputCls} resize-none`

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const params = useParams()
  const productId = params.id as string

  const [activeTab, setActiveTab] = useState<'info' | 'photos' | 'ceps'>('info')
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProduct = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/products/${productId}`, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setProduct(data.product ?? data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => { fetchProduct() }, [fetchProduct])

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading...</div>
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-gray-500">Product not found.</p>
        <Link href="/products" className="text-sm text-violet-600 hover:underline">Back to Products</Link>
      </div>
    )
  }

  const TABS = [
    { key: 'info', label: 'Info' },
    { key: 'photos', label: 'Photos' },
    { key: 'ceps', label: 'CEPs' },
  ] as const

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm">
        <Link href="/products" className="text-gray-500 hover:text-gray-700">Products</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-900">{product.name}</span>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === key
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'info' && (
        <InfoTab product={product} productId={productId} onSaved={fetchProduct} />
      )}
      {activeTab === 'photos' && (
        <PhotosTab productId={productId} />
      )}
      {activeTab === 'ceps' && (
        <CepsTab productId={productId} />
      )}
    </div>
  )
}

// ─── Tab 1: Info ──────────────────────────────────────────────────────────────

function InfoTab({ product, productId, onSaved }: { product: Product; productId: string; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: product.name,
    description: product.description ?? '',
    mainBenefit: product.mainBenefit ?? '',
    price: product.price ?? '',
    shopeeUrl: product.shopeeUrl ?? '',
    ingredients: product.ingredients ?? '',
    usageInstruction: product.usageInstruction ?? '',
    notes: product.notes ?? '',
    status: product.status,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          mainBenefit: form.mainBenefit.trim() || undefined,
          price: form.price ? Number(form.price) : undefined,
          shopeeUrl: form.shopeeUrl.trim() || undefined,
          ingredients: form.ingredients.trim() || undefined,
          usageInstruction: form.usageInstruction.trim() || undefined,
          notes: form.notes.trim() || undefined,
          status: form.status,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onSaved()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 max-w-2xl">
      {/* ── Main fields ── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
        <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={inputCls} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} className={textareaCls} placeholder="Deskripsi produk — ini yang dibaca Hermes untuk generate konten" />
        <p className="text-xs text-gray-400 mt-1">Tulis selengkap mungkin. Hermes membaca ini sebagai referensi utama produk.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Price (Rp)</label>
          <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={inputCls} placeholder="75000" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Shopee URL</label>
          <input type="url" value={form.shopeeUrl} onChange={(e) => setForm({ ...form, shopeeUrl: e.target.value })} className={inputCls} placeholder="https://s.shopee.co.id/..." />
        </div>
      </div>

      {/* ── Advanced toggle ── */}
      <button
        type="button"
        onClick={() => setShowAdvanced(v => !v)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <span className={`transition-transform inline-block ${showAdvanced ? 'rotate-90' : ''}`}>▶</span>
        Detail Lanjutan (Main Benefit, Ingredients, Usage, Notes, Status)
      </button>

      {showAdvanced && (
        <div className="space-y-4 pt-2 border-t border-gray-100">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Main Benefit</label>
            <input type="text" value={form.mainBenefit} onChange={(e) => setForm({ ...form, mainBenefit: e.target.value })} className={inputCls} placeholder="Cerahkan kulit dalam 7 hari" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ingredients</label>
              <textarea value={form.ingredients} onChange={(e) => setForm({ ...form, ingredients: e.target.value })} rows={3} className={textareaCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usage Instruction</label>
              <textarea value={form.usageInstruction} onChange={(e) => setForm({ ...form, usageInstruction: e.target.value })} rows={3} className={textareaCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={textareaCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">⚠️ {saveError}</div>
      )}
      <div className="flex justify-end pt-2">
        <button type="submit" disabled={saving || !form.name.trim()} className="btn-success">
          {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}

// ─── Tab 2: Photos ─────────────────────────────────────────────────────────────

function PhotosTab({ productId }: { productId: string }) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadLabel, setUploadLabel] = useState('')
  const [uploadCategory, setUploadCategory] = useState('')
  const [uploading, setUploading] = useState(false)
  const [editLabelId, setEditLabelId] = useState<string | null>(null)
  const [editLabelVal, setEditLabelVal] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [lightboxPhoto, setLightboxPhoto] = useState<{
    fileUrl: string; label?: string | null; category?: string | null
  } | null>(null)

  const fetchPhotos = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/products/${productId}`, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const prod = data.product ?? data
      setPhotos(prod.photoReferences ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => { fetchPhotos() }, [fetchPhotos])

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      fd.append('label', uploadLabel || uploadFile.name)
      fd.append('productId', productId)
      if (uploadCategory) fd.append('category', uploadCategory)
      const res = await fetch('/api/photos/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      setShowUpload(false)
      setUploadFile(null)
      setUploadLabel('')
      setUploadCategory('')
      await fetchPhotos()
    } catch {
      alert('Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Hapus foto ini permanen?')) return
    setActionLoading(`delete-${photoId}`)
    try {
      const res = await fetch(`/api/admin/photos/${photoId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error()
      await fetchPhotos()
    } catch {
      alert('Gagal hapus foto.')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div>
      <PageInfo
        purpose="Foto referensi produk ini. Hermes pakai URL foto ini untuk generate konten."
        inputs={['File (JPG/PNG/WebP)', 'Label: deskripsi foto', 'Category']}
        wiring={[
          { label: '→ Railway Volume', desc: '/data/photos' },
          { label: '→ Hermes', desc: 'via /api/hermes/library — product photos section' },
        ]}
      />

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-800">Photos ({loading ? '...' : photos.length})</h3>
        <button onClick={() => setShowUpload(!showUpload)} className="btn-primary">+ Upload Photo</button>
      </div>

      {showUpload && (
        <form onSubmit={handleUpload} className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">File <span className="text-red-500">*</span></label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                required
                className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-violet-600 file:text-white hover:file:bg-violet-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
              <input type="text" value={uploadLabel} onChange={(e) => setUploadLabel(e.target.value)} placeholder="e.g. kemasan depan" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} className={inputCls}>
                <option value="">— pilih —</option>
                <option value="product">product</option>
                <option value="packaging">packaging</option>
                <option value="lifestyle">lifestyle</option>
                <option value="before_after">before_after</option>
                <option value="testimonial">testimonial</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowUpload(false)} className="btn-ghost btn-sm">Cancel</button>
            <button type="submit" disabled={uploading || !uploadFile} className="btn-primary">
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading photos...</div>
      ) : photos.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
          No photos yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <div key={photo.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden group">
              {/* Klik foto → buka lightbox */}
              <div
                className="aspect-square bg-gray-100 cursor-zoom-in overflow-hidden"
                onClick={() => setLightboxPhoto(photo)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.fileUrl}
                  alt={photo.label}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
              <div className="p-3">
                {editLabelId === photo.id ? (
                  <div className="flex gap-1 mb-2">
                    <input
                      type="text"
                      value={editLabelVal}
                      onChange={(e) => setEditLabelVal(e.target.value)}
                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                    />
                    <button onClick={() => setEditLabelId(null)} className="btn-success btn-sm">OK</button>
                  </div>
                ) : (
                  <p className="text-xs font-medium text-gray-800 mb-1 truncate">{photo.label}</p>
                )}
                {photo.category && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{photo.category}</span>
                )}
                <div className="flex gap-1 mt-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditLabelId(photo.id); setEditLabelVal(photo.label) }}
                    className="btn-warning btn-sm flex-1"
                  >
                    Edit Label
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.id) }}
                    disabled={actionLoading === `delete-${photo.id}`}
                    className="btn-danger btn-sm flex-1"
                  >
                    {actionLoading === `delete-${photo.id}` ? '...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <PhotoLightbox photo={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />
    </div>
  )
}

// ─── Tab 3: CEPs ──────────────────────────────────────────────────────────────

function CepsTab({ productId }: { productId: string }) {
  const [ceps, setCeps] = useState<Cep[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [cepText, setCepText] = useState('')
  const [savingCep, setSavingCep] = useState(false)
  const [cepError, setCepError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const fetchCeps = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/ceps?productId=${productId}&status=active`, {
        cache: 'no-store', credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setCeps(data.ceps ?? [])
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => { fetchCeps() }, [fetchCeps])

  const handleAddCep = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cepText.trim()) return
    setSavingCep(true)
    try {
      const res = await fetch('/api/admin/ceps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId, cepText: cepText.trim(), source: 'human', status: 'active' }),
      })
      if (!res.ok) throw new Error()
      setCepError(null)
      setShowModal(false)
      setCepText('')
      await fetchCeps()
    } catch {
      setCepError('Failed to save CEP.')
    } finally {
      setSavingCep(false)
    }
  }

  const handleDeactivateCep = async (cepId: string) => {
    setActionLoading(cepId)
    try {
      const res = await fetch(`/api/admin/ceps/${cepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'inactive' }),
      })
      if (!res.ok) throw new Error()
      setActionError(null)
      setCeps(prev => prev.filter(c => c.id !== cepId))
    } catch {
      setActionError('Failed to deactivate CEP.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteCep = async (cepId: string) => {
    if (!confirm('Hapus CEP ini permanen?')) return
    setActionLoading(`del-${cepId}`)
    try {
      const res = await fetch(`/api/admin/ceps/${cepId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error()
      setActionError(null)
      setCeps(prev => prev.filter(c => c.id !== cepId))
    } catch {
      setActionError('Gagal hapus CEP.')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div>
      <PageInfo
        purpose="Customer Entry Points untuk produk ini. Hermes bisa langsung tulis CEP baru yang otomatis aktif."
        inputs={['CEP text: kalimat pembuka yang menyentuh pain point']}
        wiring={[
          { label: '→ Hermes /api/hermes/ready-upload', desc: 'CEP dipilih saat Hermes generate konten' },
          { label: '→ Content Log', desc: 'cep_id dicatat tiap konten dibuat' },
        ]}
      />

      {actionError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          ⚠️ {actionError}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-800">
          CEPs ({loading ? '...' : ceps.length})
        </h3>
        <button onClick={() => { setCepText(''); setShowModal(true) }} className="btn-primary">
          + Add CEP
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading CEPs...</div>
      ) : ceps.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
          No CEPs yet. Add one manually or let Hermes write one.
        </div>
      ) : (
        <div className="space-y-1.5">
          {ceps.map((cep) => (
            <div key={cep.id} className="flex items-start justify-between gap-3 py-1.5">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <span className={`mt-0.5 flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${
                  cep.source === 'ai'
                    ? 'bg-violet-100 text-violet-600'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {cep.source === 'ai' ? 'AI' : 'Manual'}
                </span>
                <p className="text-sm text-gray-700 leading-relaxed">&ldquo;{cep.cepText}&rdquo;</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleDeactivateCep(cep.id)}
                  disabled={!!actionLoading}
                  className="text-gray-300 hover:text-orange-400 transition-colors text-lg leading-none"
                  title="Nonaktifkan"
                >
                  {actionLoading === cep.id ? '·' : '×'}
                </button>
                <button
                  onClick={() => handleDeleteCep(cep.id)}
                  disabled={!!actionLoading}
                  className="text-gray-300 hover:text-red-600 transition-colors text-xs leading-none"
                  title="Hapus permanen"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CEP Modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setCepError(null) }} title="Add CEP">
        <form onSubmit={handleAddCep} className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
            <strong>CEP</strong> (Content Entry Point) adalah kalimat pembuka yang langsung menyentuh pain point audiens — membuat mereka berhenti scroll dan merasa &ldquo;ini gue banget&rdquo;.
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hook Text <span className="text-red-500">*</span></label>
            <textarea
              value={cepText}
              onChange={(e) => setCepText(e.target.value)}
              placeholder="Kalimat pembuka yang menyentuh pain point..."
              rows={4}
              required
              autoFocus
              className={textareaCls}
            />
          </div>
          {cepError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              ⚠️ {cepError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setShowModal(false); setCepError(null) }} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={savingCep || !cepText.trim()} className="btn-primary">
              {savingCep ? 'Saving...' : 'Add CEP'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
