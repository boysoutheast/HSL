'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import PageInfo from '@/components/ui/PageInfo'

interface Product {
  id: string
  name: string
}

interface MetaAccount {
  id: string
  adAccountId: string
  accountName: string | null
}

interface Creative {
  id: string
  creativeUrl: string
  captionText: string
  hookText: string
  headline: string
  callToAction: string
}

const CTA_OPTIONS = [
  { value: 'LEARN_MORE', label: 'Learn More' },
  { value: 'SHOP_NOW', label: 'Shop Now' },
  { value: 'SIGN_UP', label: 'Sign Up' },
  { value: 'GET_QUOTE', label: 'Get Quote' },
  { value: 'CONTACT_US', label: 'Contact Us' },
  { value: 'DOWNLOAD', label: 'Download' },
  { value: 'BOOK_NOW', label: 'Book Now' },
  { value: 'WATCH_MORE', label: 'Watch More' },
]

const OBJECTIVE_OPTIONS = [
  { value: 'OUTCOME_LEADS', label: 'Leads' },
  { value: 'OUTCOME_SALES', label: 'Sales' },
  { value: 'OUTCOME_TRAFFIC', label: 'Traffic' },
]

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

function emptyCreative(): Creative {
  return { id: crypto.randomUUID(), creativeUrl: '', captionText: '', hookText: '', headline: '', callToAction: 'LEARN_MORE' }
}

export default function NewTestLaunchPage() {
  const router = useRouter()

  const [products, setProducts] = useState<Product[]>([])
  const [metaAccounts, setMetaAccounts] = useState<MetaAccount[]>([])
  const [loadingDeps, setLoadingDeps] = useState(true)

  const [productId, setProductId] = useState('')
  const [metaAccountId, setMetaAccountId] = useState('')
  const [name, setName] = useState('')
  const [dailyBudget, setDailyBudget] = useState('')
  const [objective, setObjective] = useState('OUTCOME_LEADS')
  const [launchMode, setLaunchMode] = useState('new_test')
  const [sourceAdsetId, setSourceAdsetId] = useState('')
  const [creatives, setCreatives] = useState<Creative[]>([emptyCreative()])

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const fetchDeps = useCallback(async () => {
    try {
      const [prodRes, metaRes] = await Promise.all([
        fetch('/api/admin/products', { credentials: 'include' }),
        fetch('/api/admin/meta-accounts', { credentials: 'include' }),
      ])
      if (prodRes.ok) {
        const d = await prodRes.json()
        setProducts(d.products ?? [])
      }
      if (metaRes.ok) {
        const d = await metaRes.json()
        setMetaAccounts(d.metaAccounts ?? [])
      }
    } catch { /* silent */ }
    finally { setLoadingDeps(false) }
  }, [])

  useEffect(() => { fetchDeps() }, [fetchDeps])

  const addCreative = () => {
    setCreatives((prev) => [...prev, emptyCreative()])
  }

  const removeCreative = (id: string) => {
    setCreatives((prev) => prev.filter((c) => c.id !== id))
  }

  const updateCreative = (id: string, field: keyof Creative, value: string) => {
    setCreatives((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!metaAccountId || !name.trim() || !dailyBudget) {
      setSaveError('Meta Account, Nama, dan Budget harus diisi.')
      return
    }

    setSaving(true)
    setSaveError(null)

    try {
      const res = await fetch('/api/admin/test-launches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          metaAccountId,
          productId: productId || undefined,
          name: name.trim(),
          objective,
          dailyBudget: Number(dailyBudget),
          launchMode,
          sourceAdsetId: launchMode === 'duplicate_winner' ? sourceAdsetId.trim() || undefined : undefined,
          creatives: creatives
            .filter((c) => c.creativeUrl.trim() || c.captionText.trim() || c.hookText.trim() || c.headline.trim())
            .map((c, i) => ({
              creativeUrl: c.creativeUrl.trim() || undefined,
              captionText: c.captionText.trim() || undefined,
              hookText: c.hookText.trim() || undefined,
              headline: c.headline.trim() || undefined,
              callToAction: c.callToAction || undefined,
              sortOrder: i,
            })),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`)

      router.push('/test-launches')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loadingDeps) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading...</div>
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New Test Launch</h1>
        <p className="text-sm text-gray-500 mt-0.5">Buat Meta Ads test launch baru</p>
      </div>

      <PageInfo
        purpose="Form pembuatan test launch Meta Ads. Isi data dengan lengkap, tambahkan creatives, lalu simpan sebagai draft."
        inputs={[
          'Nama launch',
          'Meta Account (wajib)',
          'Produk (opsional)',
          'Daily budget (IDR)',
          'Objective',
          'Launch mode',
          'Source Adset ID (jika duplicate_winner)',
          'Minimal 1 creative',
        ]}
        wiring={[
          { label: '→ Meta Accounts', desc: 'launch akan dijalankan pada akun Meta Ads yang dipilih' },
          { label: '→ Products', desc: 'opsional, untuk tracking & targeting' },
          { label: '→ Draft → Approval → Execute', desc: 'setelah save, submit untuk approval' },
        ]}
      />

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Basic Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Informasi Dasar</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Launch <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={inputCls}
                placeholder="Summer Sale Campaign Q3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meta Account <span className="text-red-500">*</span>
              </label>
              <select
                value={metaAccountId}
                onChange={(e) => setMetaAccountId(e.target.value)}
                required
                className={inputCls}
              >
                <option value="">-- Pilih Akun --</option>
                {metaAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.accountName ?? acc.adAccountId} ({acc.adAccountId})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Produk</label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className={inputCls}
              >
                <option value="">-- Tidak ada --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Daily Budget (IDR) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={dailyBudget}
                onChange={(e) => setDailyBudget(e.target.value)}
                required
                min="1000"
                step="1000"
                className={inputCls}
                placeholder="50000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Objective</label>
              <select
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                className={inputCls}
              >
                {OBJECTIVE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Launch Mode</label>
              <select
                value={launchMode}
                onChange={(e) => setLaunchMode(e.target.value)}
                className={inputCls}
              >
                <option value="new_test">New Test</option>
                <option value="duplicate_winner">Duplicate Winner</option>
              </select>
            </div>
          </div>

          {launchMode === 'duplicate_winner' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source Adset ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={sourceAdsetId}
                onChange={(e) => setSourceAdsetId(e.target.value)}
                className={inputCls}
                placeholder="act_1234567890#238512345678901234"
              />
            </div>
          )}
        </div>

        {/* Creatives */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Creatives</h2>
            <button
              type="button"
              onClick={addCreative}
              className="btn-primary btn-sm"
            >
              + Add Creative
            </button>
          </div>

          {creatives.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Belum ada creative. Klik Add Creative.</p>
          )}

          <div className="space-y-4">
            {creatives.map((creative, idx) => (
              <div key={creative.id} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Creative #{idx + 1}</p>
                  {creatives.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCreative(creative.id)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium"
                    >
                      Hapus
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Creative URL</label>
                    <input
                      type="url"
                      value={creative.creativeUrl}
                      onChange={(e) => updateCreative(creative.id, 'creativeUrl', e.target.value)}
                      className={inputCls}
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">CTA</label>
                    <select
                      value={creative.callToAction}
                      onChange={(e) => updateCreative(creative.id, 'callToAction', e.target.value)}
                      className={inputCls}
                    >
                      {CTA_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Caption Text</label>
                  <textarea
                    value={creative.captionText}
                    onChange={(e) => updateCreative(creative.id, 'captionText', e.target.value)}
                    rows={2}
                    className={`${inputCls} resize-none`}
                    placeholder="Caption untuk iklan..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Hook Text</label>
                    <input
                      type="text"
                      value={creative.hookText}
                      onChange={(e) => updateCreative(creative.id, 'hookText', e.target.value)}
                      className={inputCls}
                      placeholder="Hook utama..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Headline</label>
                    <input
                      type="text"
                      value={creative.headline}
                      onChange={(e) => updateCreative(creative.id, 'headline', e.target.value)}
                      className={inputCls}
                      placeholder="Headline iklan..."
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {saveError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            ⚠️ {saveError}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pb-6">
          <button
            type="button"
            onClick={() => router.push('/test-launches')}
            className="btn-ghost"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving || !metaAccountId || !name.trim() || !dailyBudget}
            className="btn-primary"
          >
            {saving ? 'Menyimpan...' : 'Simpan Draft'}
          </button>
        </div>
      </form>
    </div>
  )
}
