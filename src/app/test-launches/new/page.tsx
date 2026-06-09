'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PageInfo from '@/components/ui/PageInfo'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MetaConnection {
  id: string
  name: string | null
  appId: string | null
  status: string
  accountName: string | null
  adAccounts: Array<{
    id: string
    adAccountId: string
    adAccountName: string | null
  }>
  pages: Array<{
    id: string
    pageId: string
    pageName: string | null
    igBusinessAccountId: string | null
    igUsername: string | null
    igName: string | null
  }>
}

interface AdAccount {
  id: string
  adAccountId: string
  adAccountName: string | null
  currency: string | null
}

interface Page {
  id: string
  pageId: string
  pageName: string | null
  igBusinessAccountId: string | null
  igUsername: string | null
  igName: string | null
}

interface Creative {
  id: string
  imageUrl: string
  primaryText: string
  headline: string
  caption: string
  callToAction: string
}

interface FormData {
  name: string
  metaConnectionId: string
  metaAdAccountId: string
  objective: string
  dailyBudget: string
  currency: string
  destinationUrl: string
  launchMode: string
  sourceAdsetId: string
  notes: string
  // Step 2
  pageId: string
  // Step 3
  placementMode: 'automatic' | 'manual'
  placements: string[]
  // Step 4
  ageMin: number
  ageMax: number
  gender: 'all' | 'male' | 'female'
  // Step 5
  creatives: Creative[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const OBJECTIVE_OPTIONS = [
  { value: 'OUTCOME_LEADS', label: 'Leads' },
  { value: 'OUTCOME_SALES', label: 'Sales' },
  { value: 'OUTCOME_TRAFFIC', label: 'Traffic' },
]

const LAUNCH_MODE_OPTIONS = [
  { value: 'new_test', label: 'Test Baru' },
  { value: 'duplicate_winner', label: 'Duplikat Winner' },
]

const CTA_OPTIONS = [
  { value: 'LEARN_MORE', label: 'Learn More' },
  { value: 'SHOP_NOW', label: 'Shop Now' },
  { value: 'SIGN_UP', label: 'Sign Up' },
]

const PLACEMENT_OPTIONS = [
  { value: 'facebook_feed', label: 'Facebook Feed' },
  { value: 'facebook_stories', label: 'Facebook Stories' },
  { value: 'instagram_feed', label: 'Instagram Feed' },
  { value: 'instagram_stories', label: 'Instagram Stories' },
  { value: 'instagram_reels', label: 'Instagram Reels' },
  { value: 'instagram_explore', label: 'Instagram Explore' },
]

const GENDER_OPTIONS = [
  { value: 'all', label: 'Semua' },
  { value: 'male', label: 'Laki-laki' },
  { value: 'female', label: 'Perempuan' },
]

const STEPS = ['Basic Config', 'Page & Instagram', 'Placement', 'Audience', 'Creatives'] as const
type Step = typeof STEPS[number]

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1'
const sectionCls = 'bg-white rounded-xl border border-gray-200 p-5 space-y-4'

function emptyCreative(): Creative {
  return { id: crypto.randomUUID(), imageUrl: '', primaryText: '', headline: '', caption: '', callToAction: 'LEARN_MORE' }
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('id-ID', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewTestLaunchPage() {
  const router = useRouter()

  // ── Deps ─────────────────────────────────────────────────────────────────
  const [metaConnections, setMetaConnections] = useState<MetaConnection[]>([])
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([])
  const [pages, setPages] = useState<Page[]>([])
  const [loadingDeps, setLoadingDeps] = useState(true)

  // ── Form ─────────────────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState<Step>('Basic Config')
  const [form, setForm] = useState<FormData>({
    name: '',
    metaConnectionId: '',
    metaAdAccountId: '',
    objective: 'OUTCOME_LEADS',
    dailyBudget: '',
    currency: 'IDR',
    destinationUrl: '',
    launchMode: 'new_test',
    sourceAdsetId: '',
    notes: '',
    pageId: '',
    placementMode: 'automatic',
    placements: [],
    ageMin: 25,
    ageMax: 45,
    gender: 'all',
    creatives: [emptyCreative()],
  })

  // ── UI State ─────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [selectedPage, setSelectedPage] = useState<Page | null>(null)

  // ── Fetch Meta Connections on mount ─────────────────────────────────────
  const fetchMetaConnections = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/meta-connections', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setMetaConnections(data.metaAccounts ?? [])
      }
    } catch { /* silent */ }
    finally { setLoadingDeps(false) }
  }, [])

  useEffect(() => { fetchMetaConnections() }, [fetchMetaConnections])

  // ── Fetch Ad Accounts when meta connection selected ────────────────────
  const fetchAdAccounts = useCallback(async (metaConnectionId: string) => {
    if (!metaConnectionId) { setAdAccounts([]); return }
    try {
      const res = await fetch(`/api/admin/assets/ad-accounts?metaAccountId=${metaConnectionId}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setAdAccounts(data.adAccounts ?? [])
      }
    } catch { /* silent */ }
  }, [])

  // ── Fetch Pages when meta connection selected (Step 2) ─────────────────
  const fetchPages = useCallback(async (metaConnectionId: string) => {
    if (!metaConnectionId) { setPages([]); return }
    try {
      const res = await fetch(`/api/admin/assets/pages?metaAccountId=${metaConnectionId}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setPages(data.pages ?? [])
      }
    } catch { /* silent */ }
  }, [])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleMetaConnectionChange = (id: string) => {
    setForm((f) => ({ ...f, metaConnectionId: id, metaAdAccountId: '', pageId: '' }))
    setSelectedPage(null)
    setAdAccounts([])
    setPages([])
    if (id) {
      fetchAdAccounts(id)
    }
  }

  const handleStep2Continue = () => {
    if (!form.metaConnectionId) {
      alert('Pilih Meta Connection terlebih dahulu.')
      return
    }
    fetchPages(form.metaConnectionId)
    setCurrentStep('Page & Instagram')
  }

  const handlePageSelect = (page: Page) => {
    setSelectedPage(page)
    setForm((f) => ({ ...f, pageId: page.pageId }))
  }

  const handlePlacementsChange = (value: string) => {
    setForm((f) => {
      const has = f.placements.includes(value)
      return {
        ...f,
        placements: has
          ? f.placements.filter((p) => p !== value)
          : [...f.placements, value],
      }
    })
  }

  const addCreative = () => {
    setForm((f) => ({ ...f, creatives: [...f.creatives, emptyCreative()] }))
  }

  const removeCreative = (id: string) => {
    setForm((f) => ({ ...f, creatives: f.creatives.filter((c) => c.id !== id) }))
  }

  const updateCreative = (id: string, field: keyof Creative, value: string) => {
    setForm((f) => ({
      ...f,
      creatives: f.creatives.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setSaveError('Nama launch harus diisi.'); return }
    if (!form.metaConnectionId) { setSaveError('Pilih Meta Connection.'); return }
    if (!form.metaAdAccountId) { setSaveError('Pilih Ad Account.'); return }
    if (!form.dailyBudget || Number(form.dailyBudget) <= 0) { setSaveError('Daily Budget harus lebih dari 0.'); return }
    if (form.creatives.length === 0 || !form.creatives.some((c) => c.imageUrl.trim() || c.primaryText.trim())) {
      setSaveError('Minimal 1 creative dengan image URL atau primary text.'); return
    }

    setSaving(true)
    setSaveError(null)

    const audienceJson = JSON.stringify({
      ageMin: form.ageMin,
      ageMax: form.ageMax,
      gender: form.gender,
      locations: [{ type: 'country', key: 'ID' }],
    })

    const placementsJson = form.placementMode === 'manual' ? JSON.stringify(form.placements) : undefined

    // Determine metaAdAccountId internal id vs adAccountId string
    const selectedAdAccount = adAccounts.find((a) => a.id === form.metaAdAccountId)

    try {
      const res = await fetch('/api/admin/test-launches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          metaAccountId: form.metaConnectionId,
          metaAdAccountId: form.metaAdAccountId, // internal UUID
          name: form.name.trim(),
          objective: form.objective,
          dailyBudget: Number(form.dailyBudget),
          currency: form.currency,
          destinationUrl: form.destinationUrl.trim() || undefined,
          launchMode: form.launchMode,
          sourceAdsetId: form.launchMode === 'duplicate_winner' ? form.sourceAdsetId.trim() || undefined : undefined,
          notes: form.notes.trim() || undefined,
          pageId: selectedPage?.pageId || undefined,
          igAccountId: selectedPage?.igBusinessAccountId || undefined,
          placementMode: form.placementMode,
          placementsJson: placementsJson !== undefined ? placementsJson : undefined,
          audienceJson,
          creatives: form.creatives
            .filter((c) => c.imageUrl.trim() || c.primaryText.trim())
            .map((c, i) => ({
              creativeUrl: c.imageUrl.trim() || undefined,
              primaryText: c.primaryText.trim() || undefined,
              headline: c.headline.trim() || undefined,
              captionText: c.caption.trim() || undefined,
              callToAction: c.callToAction || undefined,
              sortOrder: i,
            })),
        }),
      })

      const text = await res.text()
      let data: any = null
      try { if (text) data = JSON.parse(text) } catch { /* ignore */ }
      if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`)

      const newId = data.testLaunch?.id ?? data.id
      router.push(`/test-launches/${newId}`)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
      setSaving(false)
    }
  }

  const stepIndex = STEPS.indexOf(currentStep)

  const canAdvanceFromStep1 = form.metaConnectionId && form.name.trim() && form.dailyBudget && Number(form.dailyBudget) > 0
  const canAdvanceFromStep2 = !!selectedPage
  const hasValidCreative = form.creatives.some((c) => c.imageUrl.trim() || c.primaryText.trim())

  if (loadingDeps) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Memuat...</div>
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/test-launches" className="text-sm text-gray-400 hover:text-gray-600">← Test Launches</Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">New Test Launch</h1>
        <p className="text-sm text-gray-500 mt-0.5">Buat Meta Ads test launch baru dengan langkah demi langkah</p>
      </div>

      {/* Step Indicator */}
      <div className="mb-6">
        <div className="flex items-center gap-1">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-1 flex-1">
              <button
                type="button"
                onClick={() => {
                  // Can navigate to previous steps freely, or step 2+ if prerequisites met
                  if (i === 0) setCurrentStep(step)
                  else if (i <= stepIndex) setCurrentStep(step)
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex-1 justify-center ${
                  i === stepIndex
                    ? 'bg-indigo-600 text-white'
                    : i < stepIndex
                    ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                    : 'bg-gray-100 text-gray-400 cursor-default'
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">
                  {i + 1}
                </span>
                <span className="hidden sm:inline">{step}</span>
              </button>
              {i < STEPS.length - 1 && <div className="w-2" />}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit}>

        {/* ── STEP 1: Basic Config ──────────────────────────────────────── */}
        {currentStep === 'Basic Config' && (
          <div className="space-y-5">
            <PageInfo
              purpose="Informasi dasar test launch. Meta Connection menentukan akun Meta Ads yang akan digunakan."
              inputs={['Nama launch', 'Meta Connection', 'Ad Account', 'Objective', 'Daily Budget', 'Launch Mode', 'Catatan']}
              wiring={[
                { label: '→ Ad Accounts', desc: 'diambil dari Meta Connection yang dipilih' },
                { label: '→ Step 2', desc: 'pilih Facebook Page & Instagram' },
              ]}
            />

            <div className={sectionCls}>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Informasi Dasar</h2>

              {/* Name */}
              <div>
                <label className={labelCls}>Nama Launch <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className={inputCls}
                  placeholder="Summer Sale Campaign Q3"
                />
              </div>

              {/* Meta Connection */}
              <div>
                <label className={labelCls}>
                  Meta Connection <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.metaConnectionId}
                  onChange={(e) => handleMetaConnectionChange(e.target.value)}
                  className={inputCls}
                >
                  <option value="">-- Pilih Meta Connection --</option>
                  {metaConnections.map((mc) => (
                    <option key={mc.id} value={mc.id}>
                      {mc.name ?? mc.appId ?? mc.id} ({mc.status}) — {mc.accountName ?? 'no name'}
                    </option>
                  ))}
                </select>
                {metaConnections.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    Belum ada Meta Connection.{' '}
                    <Link href="/meta-connections/new" className="text-indigo-600 hover:underline">Buat baru →</Link>
                  </p>
                )}
              </div>

              {/* Ad Account */}
              <div>
                <label className={labelCls}>
                  Ad Account <span className="text-red-500">*</span>
                </label>
                {form.metaConnectionId ? (
                  adAccounts.length > 0 ? (
                    <select
                      value={form.metaAdAccountId}
                      onChange={(e) => setForm((f) => ({ ...f, metaAdAccountId: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="">-- Pilih Ad Account --</option>
                      {adAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.adAccountName ?? acc.adAccountId} ({acc.adAccountId})
                          {acc.currency ? ` · ${acc.currency}` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-gray-400 py-2">Memuat ad accounts...</p>
                  )
                ) : (
                  <select disabled className={`${inputCls} bg-gray-50 text-gray-400`}>
                    <option value="">Pilih Meta Connection terlebih dahulu</option>
                  </select>
                )}
              </div>

              {/* Objective & Budget */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Objective</label>
                  <select
                    value={form.objective}
                    onChange={(e) => setForm((f) => ({ ...f, objective: e.target.value }))}
                    className={inputCls}
                  >
                    {OBJECTIVE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>
                    Daily Budget (IDR) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.dailyBudget}
                    onChange={(e) => setForm((f) => ({ ...f, dailyBudget: e.target.value }))}
                    required
                    min="1000"
                    step="1000"
                    className={inputCls}
                    placeholder="50000"
                  />
                </div>
              </div>

              {/* Destination URL */}
              <div>
                <label className={labelCls}>Destination URL</label>
                <input
                  type="url"
                  value={form.destinationUrl}
                  onChange={(e) => setForm((f) => ({ ...f, destinationUrl: e.target.value }))}
                  className={inputCls}
                  placeholder="https://..."
                />
              </div>

              {/* Launch Mode */}
              <div>
                <label className={labelCls}>Launch Mode</label>
                <div className="flex gap-3">
                  {LAUNCH_MODE_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors text-sm ${
                        form.launchMode === opt.value
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="launchMode"
                        value={opt.value}
                        checked={form.launchMode === opt.value}
                        onChange={(e) => setForm((f) => ({ ...f, launchMode: e.target.value }))}
                        className="sr-only"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Source Adset ID for duplicate_winner */}
              {form.launchMode === 'duplicate_winner' && (
                <div>
                  <label className={labelCls}>Source Adset ID</label>
                  <input
                    type="text"
                    value={form.sourceAdsetId}
                    onChange={(e) => setForm((f) => ({ ...f, sourceAdsetId: e.target.value }))}
                    className={inputCls}
                    placeholder="act_1234567890#238512345678901234"
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <label className={labelCls}>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className={`${inputCls} resize-none`}
                  placeholder="Catatan tambahan (opsional)..."
                />
              </div>
            </div>

            {saveError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                ⚠️ {saveError}
              </div>
            )}

            <div className="flex justify-end gap-3 pb-6">
              <Link href="/test-launches" className="btn-ghost">Batal</Link>
              <button
                type="button"
                onClick={() => {
                  if (!form.metaConnectionId) { alert('Pilih Meta Connection terlebih dahulu.'); return }
                  if (!form.name.trim()) { alert('Nama launch harus diisi.'); return }
                  if (!form.dailyBudget || Number(form.dailyBudget) <= 0) { alert('Daily Budget harus lebih dari 0.'); return }
                  handleStep2Continue()
                }}
                className="btn-primary"
              >
                Lanjut ke Page & Instagram →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Page & Instagram ──────────────────────────────────── */}
        {currentStep === 'Page & Instagram' && (
          <div className="space-y-5">
            <PageInfo
              purpose="Pilih Facebook Page yang akan digunakan. Jika page memiliki Instagram Business Account, bisa digunakan untuk iklan Instagram."
              inputs={['Facebook Page', 'Instagram (jika ada)']}
              wiring={[
                { label: '→ Page Cards', desc: 'klik untuk memilih page' },
                { label: '→ Warning', desc: 'page tanpa IG tidak bisa dipakai untuk iklan Instagram' },
              ]}
            />

            <div className={sectionCls}>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Pilih Facebook Page
              </h2>
              <p className="text-xs text-gray-500">
                Pilih 1 page. Jika page memiliki Instagram Business Account, Anda bisa menjalankan iklan Instagram.
              </p>

              {pages.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Memuat pages...
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  {pages.map((page) => (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => handlePageSelect(page)}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        selectedPage?.id === page.id
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                      }`}
                    >
                      {/* Page icon + name */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">
                            {page.pageName ?? page.pageId}
                          </p>
                          <p className="text-xs text-gray-400 font-mono truncate">{page.pageId}</p>
                        </div>
                      </div>

                      {/* Instagram info */}
                      {page.igBusinessAccountId ? (
                        <div className="flex items-center gap-2 bg-pink-50 rounded-lg px-3 py-2 mt-1">
                          <svg className="w-4 h-4 text-pink-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.445.649-1.445 1.445 0 .796.649 1.445 1.445 1.445s1.445-.649 1.445-1.445c0-.796-.649-1.445-1.445-1.445z"/>
                          </svg>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-pink-700">@{page.igUsername}</p>
                            <p className="text-xs text-pink-500">Instagram Business ✓</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 mt-1">
                          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.445.649-1.445 1.445 0 .796.649 1.445 1.445 1.445s1.445-.649 1.445-1.445c0-.796-.649-1.445-1.445-1.445z"/>
                          </svg>
                          <p className="text-xs text-gray-500">Tidak ada Instagram</p>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* No IG warning */}
              {selectedPage && !selectedPage.igBusinessAccountId && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                  ⚠️ <strong>Page ini belum punya Instagram.</strong> Iklan Instagram tidak bisa jalan. Pilih page lain atau lanjutkan hanya dengan Facebook Ads.
                </div>
              )}

              {/* Selected page summary */}
              {selectedPage && (
                <div className="mt-4 p-4 bg-indigo-50 rounded-xl border border-indigo-200">
                  <p className="text-xs font-semibold text-indigo-600 uppercase mb-2">Page Terpilih</p>
                  <p className="font-medium text-gray-900">{selectedPage.pageName ?? selectedPage.pageId}</p>
                  {selectedPage.igUsername && (
                    <p className="text-sm text-pink-600 mt-1">
                      Instagram: @{selectedPage.igUsername}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between gap-3 pb-6">
              <button type="button" onClick={() => setCurrentStep('Basic Config')} className="btn-ghost">
                ← Kembali
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!selectedPage) { alert('Pilih Facebook Page terlebih dahulu.'); return }
                  setCurrentStep('Placement')
                }}
                className="btn-primary"
              >
                Lanjut ke Placement →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Placement ─────────────────────────────────────────── */}
        {currentStep === 'Placement' && (
          <div className="space-y-5">
            <PageInfo
              purpose="Pilih bagaimana iklan ditampilkan. Automatic = Meta optimasi otomatis. Manual = pilih placement spesifik."
              inputs={['Placement Mode', 'Placements (jika manual)']}
              wiring={[
                { label: '→ Automatic', desc: 'Meta tentukan placement terbaik' },
                { label: '→ Manual', desc: 'pilih sendiri placement yang diinginkan' },
              ]}
            />

            <div className={sectionCls}>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Placement</h2>

              {/* Mode Toggle */}
              <div>
                <label className={labelCls}>Mode</label>
                <div className="flex gap-3">
                  {(['automatic', 'manual'] as const).map((mode) => (
                    <label
                      key={mode}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors text-sm ${
                        form.placementMode === mode
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="placementMode"
                        value={mode}
                        checked={form.placementMode === mode}
                        onChange={() => setForm((f) => ({ ...f, placementMode: mode }))}
                        className="sr-only"
                      />
                      {mode === 'automatic' ? '⚡ Automatic' : '✋ Manual'}
                    </label>
                  ))}
                </div>
              </div>

              {/* Manual placements */}
              {form.placementMode === 'manual' && (
                <div>
                  <label className={labelCls}>Pilih Placements</label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {PLACEMENT_OPTIONS.map((opt) => {
                      const checked = form.placements.includes(opt.value)
                      return (
                        <label
                          key={opt.value}
                          className={`flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer transition-colors text-sm ${
                            checked
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handlePlacementsChange(opt.value)}
                            className="sr-only"
                          />
                          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                            checked ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
                          }`}>
                            {checked && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                              </svg>
                            )}
                          </div>
                          {opt.label}
                        </label>
                      )
                    })}
                  </div>
                  {form.placements.length === 0 && (
                    <p className="text-xs text-amber-600 mt-2">Pilih minimal 1 placement.</p>
                  )}
                </div>
              )}

              {form.placementMode === 'automatic' && (
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                  <p>Meta akan secara otomatis memilih placement terbaik untuk mencapai objective <strong>{OBJECTIVE_OPTIONS.find((o) => o.value === form.objective)?.label}</strong>.</p>
                </div>
              )}
            </div>

            <div className="flex justify-between gap-3 pb-6">
              <button type="button" onClick={() => setCurrentStep('Page & Instagram')} className="btn-ghost">
                ← Kembali
              </button>
              <button
                type="button"
                onClick={() => {
                  if (form.placementMode === 'manual' && form.placements.length === 0) {
                    alert('Pilih minimal 1 placement.'); return
                  }
                  setCurrentStep('Audience')
                }}
                className="btn-primary"
              >
                Lanjut ke Audience →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Audience ──────────────────────────────────────────── */}
        {currentStep === 'Audience' && (
          <div className="space-y-5">
            <PageInfo
              purpose="Tentukan siapa yang melihat iklan Anda. Default: umur 25-45, semua gender, Indonesia."
              inputs={['Age Range', 'Gender', 'Location']}
              wiring={[
                { label: '→ Location', desc: 'saat ini hanya negara (Indonesia)' },
                { label: '→ Step 5', desc: 'tambahkan creatives untuk iklan' },
              ]}
            />

            <div className={sectionCls}>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Audience</h2>

              {/* Age Range */}
              <div>
                <label className={labelCls}>Age Range</label>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Min</label>
                    <input
                      type="number"
                      value={form.ageMin}
                      onChange={(e) => setForm((f) => ({ ...f, ageMin: Math.max(18, Math.min(65, Number(e.target.value))) }))}
                      min={18}
                      max={65}
                      className={inputCls}
                    />
                  </div>
                  <span className="text-gray-400 mt-5">—</span>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Max</label>
                    <input
                      type="number"
                      value={form.ageMax}
                      onChange={(e) => setForm((f) => ({ ...f, ageMax: Math.max(18, Math.min(65, Number(e.target.value))) }))}
                      min={18}
                      max={65}
                      className={inputCls}
                    />
                  </div>
                </div>
                {(form.ageMin > form.ageMax) && (
                  <p className="text-xs text-red-500 mt-1">Age min tidak boleh lebih besar dari age max.</p>
                )}
              </div>

              {/* Gender */}
              <div>
                <label className={labelCls}>Gender</label>
                <div className="flex gap-3">
                  {GENDER_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors text-sm ${
                        form.gender === opt.value
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="gender"
                        value={opt.value}
                        checked={form.gender === opt.value}
                        onChange={() => setForm((f) => ({ ...f, gender: opt.value as 'all' | 'male' | 'female' }))}
                        className="sr-only"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Location */}
              <div>
                <label className={labelCls}>Location</label>
                <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 rounded-lg border border-gray-200 text-sm">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  <span className="text-gray-700">Indonesia</span>
                  <span className="text-xs text-gray-400 ml-auto">Country · ID</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Location tingkat negara saja untuk saat ini.</p>
              </div>

              {/* Summary */}
              <div className="bg-indigo-50 rounded-lg p-4 text-sm">
                <p className="text-xs font-semibold text-indigo-600 uppercase mb-2">Audience Summary</p>
                <p className="text-gray-800">
                  Umur <strong>{form.ageMin}–{form.ageMax}</strong> ·
                  Gender <strong>{GENDER_OPTIONS.find((g) => g.value === form.gender)?.label}</strong> ·
                  Lokasi <strong>Indonesia</strong>
                </p>
              </div>
            </div>

            <div className="flex justify-between gap-3 pb-6">
              <button type="button" onClick={() => setCurrentStep('Placement')} className="btn-ghost">
                ← Kembali
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep('Creatives')}
                className="btn-primary"
              >
                Lanjut ke Creatives →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 5: Creatives ─────────────────────────────────────────── */}
        {currentStep === 'Creatives' && (
          <div className="space-y-5">
            <PageInfo
              purpose="Tambahkan creative untuk iklan. Minimal 1 creative. Anda bisa menambah beberapa creative untuk A/B testing."
              inputs={['Image URL', 'Primary Text', 'Headline', 'Caption', 'Call to Action']}
              wiring={[
                { label: '→ Submit', desc: 'POST /api/admin/test-launches' },
                { label: '→ Redirect', desc: 'ke halaman detail setelah berhasil' },
              ]}
            />

            <div className={sectionCls}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Creatives</h2>
                <button
                  type="button"
                  onClick={addCreative}
                  className="btn-primary btn-sm"
                >
                  + Tambah Creative
                </button>
              </div>

              {form.creatives.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Belum ada creative. Klik Tambah Creative.</p>
              )}

              <div className="space-y-4">
                {form.creatives.map((creative, idx) => (
                  <div key={creative.id} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-500 uppercase">Creative #{idx + 1}</p>
                      {form.creatives.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCreative(creative.id)}
                          className="text-red-500 hover:text-red-700 text-xs font-medium"
                        >
                          Hapus
                        </button>
                      )}
                    </div>

                    {/* Image URL */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Image URL</label>
                      <input
                        type="url"
                        value={creative.imageUrl}
                        onChange={(e) => updateCreative(creative.id, 'imageUrl', e.target.value)}
                        className={inputCls}
                        placeholder="https://..."
                      />
                    </div>

                    {/* Primary Text */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Primary Text (Ad Body)</label>
                      <textarea
                        value={creative.primaryText}
                        onChange={(e) => updateCreative(creative.id, 'primaryText', e.target.value)}
                        rows={3}
                        className={`${inputCls} resize-none`}
                        placeholder="Isi deskripsi utama iklan..."
                      />
                    </div>

                    {/* Headline & CTA */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Headline</label>
                        <input
                          type="text"
                          value={creative.headline}
                          onChange={(e) => updateCreative(creative.id, 'headline', e.target.value)}
                          className={inputCls}
                          placeholder="Judul iklan..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Call to Action</label>
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

                    {/* Caption */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Caption</label>
                      <input
                        type="text"
                        value={creative.caption}
                        onChange={(e) => updateCreative(creative.id, 'caption', e.target.value)}
                        className={inputCls}
                        placeholder="Caption tambahan..."
                      />
                    </div>
                  </div>
                ))}
              </div>

              {!hasValidCreative && (
                <p className="text-xs text-amber-600 mt-2">
                  ⚠️ Minimal 1 creative harus memiliki Image URL atau Primary Text.
                </p>
              )}
            </div>

            {saveError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                ⚠️ {saveError}
              </div>
            )}

            {/* Summary before submit */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-2 text-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Ringkasan Launch</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                <p className="text-gray-500">Nama</p>
                <p className="font-medium text-gray-900">{form.name || '—'}</p>
                <p className="text-gray-500">Objective</p>
                <p className="text-gray-900">{OBJECTIVE_OPTIONS.find((o) => o.value === form.objective)?.label}</p>
                <p className="text-gray-500">Daily Budget</p>
                <p className="text-gray-900">Rp{Number(form.dailyBudget).toLocaleString('id-ID') || '—'}</p>
                <p className="text-gray-500">Launch Mode</p>
                <p className="text-gray-900">{LAUNCH_MODE_OPTIONS.find((l) => l.value === form.launchMode)?.label}</p>
                <p className="text-gray-500">Placement</p>
                <p className="text-gray-900">{form.placementMode === 'automatic' ? 'Automatic' : `${form.placements.length} placements`}</p>
                <p className="text-gray-500">Audience</p>
                <p className="text-gray-900">{form.ageMin}–{form.ageMax} · {GENDER_OPTIONS.find((g) => g.value === form.gender)?.label} · ID</p>
                <p className="text-gray-500">Creatives</p>
                <p className="text-gray-900">{form.creatives.length}</p>
              </div>
            </div>

            <div className="flex justify-between gap-3 pb-6">
              <button type="button" onClick={() => setCurrentStep('Audience')} className="btn-ghost">
                ← Kembali
              </button>
              <button
                type="submit"
                disabled={saving || !hasValidCreative || form.ageMin > form.ageMax}
                className="btn-primary"
              >
                {saving ? 'Menyimpan...' : '💾 Simpan Draft'}
              </button>
            </div>
          </div>
        )}

      </form>
    </div>
  )
}
