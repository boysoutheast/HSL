'use client'

import { useState, useEffect } from 'react'

interface Product {
  id: string
  name: string
  description: string | null
  mainBenefit: string | null
  _count?: { topics: number; ceps: number; photoReferences: number }
}

export default function StepZeroOverlay({
  onChooseProduct,
  onChooseEmpty,
  onClose,
}: {
  onChooseProduct: (productId: string) => void
  onChooseEmpty: () => void
  onClose: () => void
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/products?status=active')
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-2xl w-full space-y-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-stone-900">Mulai dari mana?</h2>
        <p className="text-sm text-stone-500">Pilih cara memulai launch baru kamu.</p>

        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            className="border-2 border-stone-200 rounded-2xl p-6 text-left hover:border-violet-300 hover:bg-violet-50/30 transition-all space-y-2 flex flex-col items-start"
            onClick={onChooseEmpty}
          >
            <span className="text-3xl">✏️</span>
            <span className="font-semibold text-stone-900">Kosong</span>
            <span className="text-sm text-stone-500">Mulai dari nol, isi semua manual.</span>
          </button>

          <button
            type="button"
            className={`border-2 rounded-2xl p-6 text-left transition-all space-y-2 flex flex-col items-start ${
              selectedId ? 'border-violet-300 bg-violet-50/50' : 'border-stone-200 hover:border-violet-300 hover:bg-violet-50/30'
            }`}
            onClick={() => {
              if (products.length > 0 && !selectedId) {
                const first = products[0]
                setSelectedId(first.id)
              }
            }}
          >
            <span className="text-3xl">🛍</span>
            <span className="font-semibold text-stone-900">Dari Produk</span>
            <span className="text-sm text-stone-500">Isi otomatis dari data produk.</span>

            {loading ? (
              <div className="text-xs text-stone-400 mt-1">Memuat produk...</div>
            ) : products.length === 0 ? (
              <div className="text-xs text-amber-600 mt-1">Belum ada produk aktif.</div>
            ) : (
              <div className="mt-2 w-full">
                <select
                  value={selectedId ?? ''}
                  onChange={(e) => setSelectedId(e.target.value || null)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="">-- Pilih produk --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedId}
                  className={`mt-3 w-full rounded-xl py-2.5 text-sm font-medium transition-colors ${
                    selectedId
                      ? 'bg-violet-600 text-white hover:bg-violet-700'
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (selectedId) onChooseProduct(selectedId)
                  }}
                >
                  {selectedId ? `Gunakan ${products.find((p) => p.id === selectedId)?.name ?? ''}` : 'Pilih produk dulu'}
                </button>
              </div>
            )}
          </button>
        </div>

        <div className="border-t border-stone-100 pt-4 flex justify-end">
          <button type="button" onClick={onClose} className="text-sm text-stone-400 hover:text-stone-600 px-4 py-2">
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
