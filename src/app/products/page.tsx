'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import StatusBadge from '@/components/ui/StatusBadge'
import Table from '@/components/ui/Table'
import PageInfo from '@/components/ui/PageInfo'
import Modal from '@/components/ui/Modal'

interface Product {
  id: string
  name: string
  description: string | null
  mainBenefit: string | null
  shopeeUrl: string | null
  price: string | null
  status: string
  notes: string | null
  ingredients: string | null
  usageInstruction: string | null
  createdAt: string
  _count?: { ceps: number; topics: number; photoReferences: number }
}

const EMPTY_ADD = { name: '', description: '', price: '', shopeeUrl: '' }
const EMPTY_EDIT = {
  name: '', description: '', price: '', shopeeUrl: '', status: 'active',
}

const inputCls = 'w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [addForm, setAddForm] = useState(EMPTY_ADD)
  const [editForm, setEditForm] = useState(EMPTY_EDIT)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/products', { cache: 'no-store', credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setProducts(data.products ?? data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setPhotoFile(file)
    if (file) {
      const url = URL.createObjectURL(file)
      setPhotoPreview(url)
    } else {
      setPhotoPreview(null)
    }
  }

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!confirm(`Hapus produk "${name}" beserta semua CEP dan foto-nya?\n\nTidak bisa dibatalkan.`)) return
    setDeleteLoading(id)
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error((await res.json()).error)
      await fetchProducts()
    } catch (err) {
      alert('Gagal hapus: ' + String(err))
    } finally {
      setDeleteLoading(null)
    }
  }

  // ── ADD SUBMIT ─────────────────────────────────────────────────────────────
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addForm.name.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      // Step 1: create product
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: addForm.name.trim(),
          description: addForm.description.trim() || undefined,
          price: addForm.price ? Number(addForm.price) : undefined,
          shopeeUrl: addForm.shopeeUrl.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`)
      const productId = data.product?.id ?? data.id

      // Step 2: upload photo if provided
      if (photoFile && productId) {
        const fd = new FormData()
        fd.append('file', photoFile)
        fd.append('productId', productId)
        fd.append('label', photoFile.name.replace(/\.[^.]+$/, ''))
        fd.append('category', 'product')
        await fetch('/api/photos/upload', { method: 'POST', credentials: 'include', body: fd })
      }

      setShowAddModal(false)
      setAddForm(EMPTY_ADD)
      setPhotoFile(null)
      setPhotoPreview(null)
      await fetchProducts()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // ── EDIT SUBMIT ────────────────────────────────────────────────────────────
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editProduct || !editForm.name.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/admin/products/${editProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: editForm.name.trim(),
          description: editForm.description.trim() || undefined,
          price: editForm.price ? Number(editForm.price) : undefined,
          shopeeUrl: editForm.shopeeUrl.trim() || undefined,
          status: editForm.status,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`)
      setShowEditModal(false)
      await fetchProducts()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (product: Product) => {
    setEditProduct(product)
    setEditForm({
      name: product.name,
      description: product.description ?? '',
      price: product.price ?? '',
      shopeeUrl: product.shopeeUrl ?? '',
      status: product.status,
    })
    setSaveError(null)
    setShowEditModal(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Products</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {loading ? '...' : `${products.length} produk`}
          </p>
        </div>
        <button
          onClick={() => { setAddForm(EMPTY_ADD); setPhotoFile(null); setPhotoPreview(null); setSaveError(null); setShowAddModal(true) }}
          className="btn-primary"
        >
          + Add Product
        </button>
      </div>

      <PageInfo
        purpose="Produk Shopee/CPAS yang dipromosikan Hermes. Klik Detail untuk kelola foto dan CEP produk."
        inputs={['Nama produk', 'Deskripsi', 'Foto produk (langsung upload)', 'Shopee URL', 'Harga']}
        wiring={[
          { label: '→ Photos', desc: 'foto bisa diupload langsung saat add, atau di tab Photos pada detail produk' },
          { label: '→ CEP', desc: 'CEP dikelola di tab CEPs pada detail produk (review CEP dari Hermes + add manual)' },
          { label: '→ Hermes API', desc: 'produk + foto dikirim via /api/hermes/library' },
        ]}
      />

      {loading ? (
        <div className="flex items-center justify-center h-48 text-stone-400 text-sm">Loading...</div>
      ) : (
        <Table
          headers={['Name', 'Price', 'Status', 'Photos', 'CEPs', 'Shopee', 'Actions']}
          empty="No products found."
        >
          {products.map((product) => (
            <tr key={product.id} className="hover:bg-stone-50 transition-colors">
              <td className="px-4 py-3">
                <p className="font-medium text-stone-900">{product.name}</p>
                {product.description && (
                  <p className="text-xs text-stone-400 mt-0.5 max-w-[200px] truncate">{product.description}</p>
                )}
              </td>
              <td className="px-4 py-3 text-stone-600 whitespace-nowrap">
                {product.price ? `Rp ${Number(product.price).toLocaleString('id-ID')}` : '—'}
              </td>
              <td className="px-4 py-3"><StatusBadge status={product.status} /></td>
              <td className="px-4 py-3 text-stone-600">{product._count?.photoReferences ?? 0}</td>
              <td className="px-4 py-3 text-stone-600">{product._count?.ceps ?? 0}</td>
              <td className="px-4 py-3">
                {product.shopeeUrl ? (
                  <a href={product.shopeeUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">Shopee ↗</a>
                ) : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(product)} className="btn-warning btn-sm">Edit</button>
                  <Link href={`/products/${product.id}`} className="btn-info btn-sm">Detail →</Link>
                  <button
                    onClick={() => handleDeleteProduct(product.id, product.name)}
                    disabled={deleteLoading === product.id}
                    className="btn-danger btn-sm"
                  >
                    {deleteLoading === product.id ? '...' : 'Delete'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {/* ── ADD MODAL (simple 5 fields) ── */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Product">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              required
              className={inputCls}
              placeholder="Serum Vitamin C 10%"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
            <textarea
              value={addForm.description}
              onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
              rows={2}
              className={`${inputCls} resize-none`}
              placeholder="Deskripsi singkat produk..."
            />
          </div>

          {/* Photo upload */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Foto Produk</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors text-center ${
                photoPreview ? 'border-violet-300 bg-violet-50' : 'border-stone-300 hover:border-violet-400 hover:bg-stone-50'
              }`}
            >
              {photoPreview ? (
                <div className="flex flex-col items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="preview" className="h-24 w-auto rounded-lg object-cover mx-auto" />
                  <p className="text-xs text-violet-600 font-medium">{photoFile?.name}</p>
                  <p className="text-xs text-stone-400">Klik untuk ganti</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 py-2">
                  <svg className="w-8 h-8 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-stone-500">Klik untuk upload foto</p>
                  <p className="text-xs text-stone-400">JPG, PNG, WebP — maks 10MB</p>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Shopee URL</label>
              <input
                type="url"
                value={addForm.shopeeUrl}
                onChange={(e) => setAddForm({ ...addForm, shopeeUrl: e.target.value })}
                className={inputCls}
                placeholder="https://shopee.co.id/..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Price (Rp)</label>
              <input
                type="number"
                value={addForm.price}
                onChange={(e) => setAddForm({ ...addForm, price: e.target.value })}
                className={inputCls}
                placeholder="150000"
              />
            </div>
          </div>

          {saveError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">⚠️ {saveError}</div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowAddModal(false)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving || !addForm.name.trim()} className="btn-primary">
              {saving ? 'Saving...' : 'Add Product'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── EDIT MODAL (5 fields only — detail fields managed in /products/[id]) ── */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title={`Edit: ${editProduct?.name}`}>
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
            <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} className={`${inputCls} resize-none`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Price (Rp)</label>
              <input type="number" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} className={inputCls} placeholder="150000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Status</label>
              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className={inputCls}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Shopee URL</label>
            <input type="url" value={editForm.shopeeUrl} onChange={(e) => setEditForm({ ...editForm, shopeeUrl: e.target.value })} className={inputCls} placeholder="https://s.shopee.co.id/..." />
          </div>
          {saveError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">⚠️ {saveError}</div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowEditModal(false)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving || !editForm.name.trim()} className="btn-success">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
