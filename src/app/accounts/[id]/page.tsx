'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import PhotoUploadModal from '@/components/PhotoUploadModal'

interface PostingMonitor {
  id: string
  status: string
  currentViews: number
  growthPerHour: number
  lastPostAt: string | null
  reason: string | null
  hermesAgent: { name: string } | null
}

interface PhotoRef {
  id: string
  fileUrl: string
  thumbnailUrl: string | null
  label: string
  category: string | null
}

interface AccountDetail {
  id: string
  username: string
  accountName: string | null
  gender: string | null
  status: string
  purpose: string | null
  notes: string | null
  lastPostAt: string | null
  createdAt: string
  characterDescription: string | null
  behavior: string | null
  speakingStyle: string | null
  expressionStyle: string | null
  movementStyle: string | null
  forbiddenRules: string | null
  photoReferences: PhotoRef[]
  postingMonitor: PostingMonitor | null
  _count?: { assignments: number }
}

const EMPTY_ACCOUNT_FORM = {
  username: '',
  accountName: '',
  gender: '',
  purpose: 'organic',
  notes: '',
  characterDescription: '',
  behavior: '',
  speakingStyle: '',
  expressionStyle: '',
  movementStyle: '',
  forbiddenRules: '',
}

const PERSONA_FIELDS = [
  { key: 'characterDescription', label: 'Deskripsi', placeholder: 'Siapa karakter ini? Latar belakang, kepribadian...' },
  { key: 'behavior',             label: 'Behavior',   placeholder: 'Cara berperilaku umum, tone, sikap...' },
  { key: 'speakingStyle',        label: 'Speaking Style',   placeholder: 'Gaya bicara, kata khas, panjang kalimat...' },
  { key: 'expressionStyle',      label: 'Expression Style', placeholder: 'Ekspresi wajah, emosi yang sering ditampilkan...' },
  { key: 'movementStyle',        label: 'Movement Style',   placeholder: 'Gaya gerakan tubuh di depan kamera...' },
  { key: 'forbiddenRules',       label: 'Forbidden Rules',  placeholder: 'Topik, kata, klaim yang DILARANG muncul...' },
] as const

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function GenderBadge({ gender }: { gender: string | null }) {
  if (gender === 'M') return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">♂ Male</span>
  )
  if (gender === 'F') return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-pink-100 text-pink-700">♀ Female</span>
  )
  return null
}

function PersonaCompleteness({ account }: { account: AccountDetail }) {
  const fields = [
    account.characterDescription,
    account.behavior,
    account.speakingStyle,
    account.expressionStyle,
    account.movementStyle,
    account.forbiddenRules,
  ]
  const filled = fields.filter(Boolean).length
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {fields.map((v, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-sm ${v ? 'bg-violet-500' : 'bg-stone-200'}`}
            title={PERSONA_FIELDS[i].label}
          />
        ))}
      </div>
      <span className={`text-xs font-medium ${filled === 0 ? 'text-red-500' : filled < 6 ? 'text-amber-600' : 'text-violet-600'}`}>
        {filled}/6
      </span>
    </div>
  )
}

export default function AccountDetailPage() {
  const params = useParams()
  const accountId = params.id as string

  const [account, setAccount] = useState<AccountDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'info' | 'persona' | 'photos'>('info')

  const [showEditModal, setShowEditModal] = useState(false)
  const [modalTab, setModalTab] = useState<'info' | 'persona'>('info')
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT_FORM)
  const [savingAccount, setSavingAccount] = useState(false)
  const [saveAccountError, setSaveAccountError] = useState<string | null>(null)

  const [lightbox, setLightbox] = useState<PhotoRef | null>(null)
  const [showPhotoUpload, setShowPhotoUpload] = useState(false)

  const fetchAccount = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/accounts/${accountId}`, { cache: 'no-store', credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setAccount(data.account ?? data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => { fetchAccount() }, [fetchAccount])

  const openEditAccount = (tab: 'info' | 'persona' = 'info') => {
    if (!account) return
    setAccountForm({
      username: account.username,
      accountName: account.accountName ?? '',
      gender: account.gender ?? '',
      purpose: account.purpose ?? 'organic',
      notes: account.notes ?? '',
      characterDescription: account.characterDescription ?? '',
      behavior: account.behavior ?? '',
      speakingStyle: account.speakingStyle ?? '',
      expressionStyle: account.expressionStyle ?? '',
      movementStyle: account.movementStyle ?? '',
      forbiddenRules: account.forbiddenRules ?? '',
    })
    setModalTab(tab)
    setShowEditModal(true)
  }

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingAccount(true)
    try {
      const res = await fetch(`/api/admin/accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: accountForm.username.trim(),
          accountName: accountForm.accountName.trim() || undefined,
          gender: accountForm.gender || null,
          purpose: accountForm.purpose || undefined,
          notes: accountForm.notes.trim() || undefined,
          characterDescription: accountForm.characterDescription.trim() || null,
          behavior: accountForm.behavior.trim() || null,
          speakingStyle: accountForm.speakingStyle.trim() || null,
          expressionStyle: accountForm.expressionStyle.trim() || null,
          movementStyle: accountForm.movementStyle.trim() || null,
          forbiddenRules: accountForm.forbiddenRules.trim() || null,
        }),
      })
      if (!res.ok) throw new Error()
      setSaveAccountError(null)
      setShowEditModal(false)
      await fetchAccount()
    } catch {
      setSaveAccountError('Failed to save account.')
    } finally {
      setSavingAccount(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-stone-400 text-sm">Loading...</div>
  }

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-stone-500">Account not found.</p>
        <Link href="/influencer" className="text-sm text-violet-600 hover:underline">Kembali ke Influencer</Link>
      </div>
    )
  }

  const TABS = [
    { key: 'info',    label: 'Info & Monitor' },
    { key: 'persona', label: 'Persona' },
    { key: 'photos',  label: `Photos (${account.photoReferences.length})` },
  ] as const

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2">
        <Link href="/influencer" className="text-sm text-stone-500 hover:text-stone-700">Influencer</Link>
        <span className="text-stone-300">/</span>
        <span className="text-sm font-medium text-stone-900">@{account.username}</span>
      </div>

      {/* Main card */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold text-stone-900">@{account.username}</h1>
              <StatusBadge status={account.status} />
              <GenderBadge gender={account.gender} />
            </div>
            {account.accountName && (
              <p className="text-stone-500 text-sm mt-0.5">{account.accountName}</p>
            )}
          </div>
          <button onClick={() => openEditAccount('info')} className="btn-warning btn-sm shrink-0 ml-4">
            Edit Account
          </button>
        </div>

        {/* Meta strip */}
        <div className="flex gap-6 px-6 py-3 bg-stone-50 border-b border-stone-100 flex-wrap text-sm">
          <div>
            <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">Purpose</p>
            <p className="text-stone-700 font-medium mt-0.5">{account.purpose ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">Last Post</p>
            <p className="text-stone-700 font-medium mt-0.5">{formatDate(account.lastPostAt)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">AI Buddy Agents</p>
            <p className="text-stone-700 font-medium mt-0.5">{account._count?.assignments ?? 0} assigned</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">Persona</p>
            <div className="mt-1"><PersonaCompleteness account={account} /></div>
          </div>
          <div>
            <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">Created</p>
            <p className="text-stone-700 font-medium mt-0.5">{formatDate(account.createdAt)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-100 px-6">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 px-1 mr-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-violet-600 text-violet-700'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Info & Monitor ── */}
        {activeTab === 'info' && (
          <div className="px-6 py-5 space-y-5">
            {account.postingMonitor ? (
              <div>
                <p className="text-xs text-stone-400 font-semibold uppercase tracking-wide mb-3">Posting Monitor</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-stone-400 uppercase tracking-wide font-medium mb-1">Status</p>
                    <StatusBadge status={account.postingMonitor.status} />
                  </div>
                  <div>
                    <p className="text-xs text-stone-400 uppercase tracking-wide font-medium mb-1">Views</p>
                    <p className="text-stone-800 font-semibold">{account.postingMonitor.currentViews.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-400 uppercase tracking-wide font-medium mb-1">Growth/hr</p>
                    <p className="text-stone-800 font-semibold">{account.postingMonitor.growthPerHour.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-400 uppercase tracking-wide font-medium mb-1">AI Buddy</p>
                    <p className="text-stone-800">{account.postingMonitor.hermesAgent?.name ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-400 uppercase tracking-wide font-medium mb-1">Reason</p>
                    <p className="text-stone-800 truncate">{account.postingMonitor.reason ?? '—'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-stone-400 italic">Belum ada posting monitor untuk akun ini.</p>
            )}

            {account.notes && (
              <div>
                <p className="text-xs text-stone-400 font-semibold uppercase tracking-wide mb-2">Notes</p>
                <p className="text-sm text-stone-700 bg-stone-50 rounded-lg px-4 py-3">{account.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Persona ── */}
        {activeTab === 'persona' && (
          <div className="px-6 py-5">
            {PERSONA_FIELDS.every(f => !account[f.key]) ? (
              <div className="text-center py-8">
                <p className="text-stone-400 text-sm mb-3">Persona belum diisi untuk akun ini.</p>
                <button onClick={() => openEditAccount('persona')} className="btn-primary btn-sm">
                  + Isi Persona
                </button>
              </div>
            ) : (
              <div className="space-y-0 divide-y divide-stone-100">
                {PERSONA_FIELDS.map(({ key, label }) => (
                  <div key={key} className="flex gap-4 py-3">
                    <p className="text-xs text-stone-400 font-semibold uppercase tracking-wide min-w-[120px] pt-0.5">{label}</p>
                    {account[key] ? (
                      <p className="text-sm text-stone-800 whitespace-pre-wrap leading-relaxed">{account[key]}</p>
                    ) : (
                      <p className="text-sm text-stone-300 italic">— belum diisi</p>
                    )}
                  </div>
                ))}
                <div className="pt-4">
                  <button onClick={() => openEditAccount('persona')} className="btn-warning btn-sm">
                    Edit Persona
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Photos ── */}
        {activeTab === 'photos' && (
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-stone-500">
                {account.photoReferences.length > 0
                  ? `${account.photoReferences.length} foto`
                  : 'Belum ada foto referensi'}
              </p>
              <button
                onClick={() => setShowPhotoUpload(true)}
                className="btn-primary btn-sm"
              >
                ➕ Add Photo
              </button>
            </div>

            {account.photoReferences.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {account.photoReferences.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setLightbox(p)}
                    className="relative group focus:outline-none"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.thumbnailUrl ?? p.fileUrl}
                      alt={p.label}
                      className="w-24 h-24 object-cover rounded-lg border border-stone-200 group-hover:border-violet-400 transition-colors"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-colors" />
                    <p className="text-[10px] text-stone-400 mt-1 truncate w-24 text-center">{p.label}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Lightbox */}
      <Modal open={lightbox !== null} onClose={() => setLightbox(null)} title={lightbox?.label ?? ''}>
        {lightbox && (
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.fileUrl}
              alt={lightbox.label}
              className="max-w-full max-h-[70vh] object-contain rounded-lg mx-auto"
            />
            {lightbox.category && (
              <p className="text-xs text-stone-400 mt-3">Kategori: {lightbox.category}</p>
            )}
            <div className="mt-3">
              <a href={lightbox.fileUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
                Buka original ↗
              </a>
            </div>
          </div>
        )}
      </Modal>

      <PhotoUploadModal
        open={showPhotoUpload}
        onClose={() => setShowPhotoUpload(false)}
        onSuccess={fetchAccount}
        instagramAccountId={accountId}
      />

      {/* Edit Account Modal — tabbed */}
      <Modal
        open={showEditModal}
        onClose={() => { setShowEditModal(false); setSaveAccountError(null) }}
        title={`Edit @${account.username}`}
      >
        {/* Modal tab switcher */}
        <div className="flex gap-1 mb-4 p-1 bg-stone-100 rounded-lg">
          {(['info', 'persona'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setModalTab(t)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                modalTab === t
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {t === 'info' ? 'Info' : 'Persona'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSaveAccount} className="space-y-3">
          {/* ── Tab Info ── */}
          {modalTab === 'info' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Username <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={accountForm.username}
                    onChange={(e) => setAccountForm({ ...accountForm, username: e.target.value })}
                    required
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Account Name</label>
                  <input
                    type="text"
                    value={accountForm.accountName}
                    onChange={(e) => setAccountForm({ ...accountForm, accountName: e.target.value })}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Gender</label>
                  <select
                    value={accountForm.gender}
                    onChange={(e) => setAccountForm({ ...accountForm, gender: e.target.value })}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="">— tidak ditentukan —</option>
                    <option value="M">♂ Male (M)</option>
                    <option value="F">♀ Female (F)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Purpose</label>
                  <select
                    value={accountForm.purpose}
                    onChange={(e) => setAccountForm({ ...accountForm, purpose: e.target.value })}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="organic">organic</option>
                    <option value="cpas">cpas</option>
                    <option value="education">education</option>
                    <option value="soft_selling">soft_selling</option>
                    <option value="mixed">mixed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Notes</label>
                <textarea
                  value={accountForm.notes}
                  onChange={(e) => setAccountForm({ ...accountForm, notes: e.target.value })}
                  rows={3}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              </div>
            </>
          )}

          {/* ── Tab Persona ── */}
          {modalTab === 'persona' && (
            <div className="space-y-3">
              <p className="text-xs text-stone-400 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
                Persona ini dikirim ke Hermes via <code className="font-mono">/api/hermes/library</code> — isi sedetail mungkin.
              </p>
              {PERSONA_FIELDS.map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    {label}
                    {key === 'forbiddenRules' && <span className="ml-1 text-xs text-red-500 font-normal">(penting)</span>}
                  </label>
                  <textarea
                    value={accountForm[key]}
                    onChange={(e) => setAccountForm({ ...accountForm, [key]: e.target.value })}
                    rows={2}
                    placeholder={placeholder}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none ${
                      key === 'forbiddenRules' ? 'border-red-200' : 'border-stone-300'
                    }`}
                  />
                </div>
              ))}
            </div>
          )}

          {saveAccountError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              ⚠️ {saveAccountError}
            </div>
          )}
          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={() => setModalTab(modalTab === 'info' ? 'persona' : 'info')}
              className="text-xs text-stone-400 hover:text-stone-600"
            >
              {modalTab === 'info' ? 'Lanjut ke Persona →' : '← Kembali ke Info'}
            </button>
            <div className="flex gap-3">
              <button type="button" onClick={() => { setShowEditModal(false); setSaveAccountError(null) }} className="btn-ghost">Cancel</button>
              <button type="submit" disabled={savingAccount} className="btn-success">
                {savingAccount ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
