'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import StatusBadge from '@/components/ui/StatusBadge'
import PageInfo from '@/components/ui/PageInfo'
import Modal from '@/components/ui/Modal'

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

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AccountDetailPage() {
  const params = useParams()
  const accountId = params.id as string

  const [account, setAccount] = useState<AccountDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT_FORM)
  const [savingAccount, setSavingAccount] = useState(false)
  const [saveAccountError, setSaveAccountError] = useState<string | null>(null)

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

  const openEditAccount = () => {
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
        <Link href="/accounts" className="text-sm text-violet-600 hover:underline">Back to Accounts</Link>
      </div>
    )
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2">
        <Link href="/accounts" className="text-sm text-stone-500 hover:text-stone-700">Accounts</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-stone-900">@{account.username}</span>
      </div>

      <PageInfo
        purpose={`Detail akun @${account.username} — persona, foto referensi, posting monitor, dan relasi Hermes Agent.`}
        wiring={[
          { label: '→ Posting Monitor', desc: 'status real-time akun ini' },
          { label: '→ Persona', desc: 'character fields langsung di akun ini (behavior, speaking style, dll)' },
          { label: '→ Assignments', desc: `${account._count?.assignments ?? 0} Hermes agent ter-assign` },
        ]}
      />

      {/* Account Info Card */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">@{account.username}</h1>
            {account.accountName && (
              <p className="text-stone-600 mt-0.5">{account.accountName}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={account.status} />
            <button onClick={openEditAccount} className="btn-warning btn-sm">Edit Account</button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Gender</p>
            <p className="text-stone-800">
              {account.gender === 'M' ? '♂ Male' : account.gender === 'F' ? '♀ Female' : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Purpose</p>
            <p className="text-stone-800">{account.purpose ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Last Post</p>
            <p className="text-stone-800">{formatDate(account.lastPostAt)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Created</p>
            <p className="text-stone-800">{formatDate(account.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Hermes Assignments</p>
            <p className="text-stone-800">{account._count?.assignments ?? 0}</p>
          </div>
        </div>

        {account.notes && (
          <div className="mt-4 p-3 bg-stone-50 rounded-lg">
            <p className="text-xs text-stone-500 font-medium mb-1">Notes</p>
            <p className="text-sm text-stone-700">{account.notes}</p>
          </div>
        )}
      </div>

      {/* Posting Monitor */}
      {account.postingMonitor && (
        <div className="bg-white rounded-xl border border-stone-200 p-6 mb-6">
          <h2 className="text-base font-semibold text-stone-900 mb-4">Posting Monitor</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Status</p>
              <StatusBadge status={account.postingMonitor.status} />
            </div>
            <div>
              <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Current Views</p>
              <p className="text-stone-800 font-medium">{account.postingMonitor.currentViews.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Growth/hr</p>
              <p className="text-stone-800 font-medium">{account.postingMonitor.growthPerHour.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Assigned Hermes</p>
              <p className="text-stone-800">{account.postingMonitor.hermesAgent?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Reason</p>
              <p className="text-stone-800 truncate">{account.postingMonitor.reason ?? '—'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Persona */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-stone-900">Persona</h2>
          <button onClick={openEditAccount} className="btn-warning btn-sm">Edit</button>
        </div>
        {[
          ['Deskripsi', account.characterDescription],
          ['Behavior', account.behavior],
          ['Speaking Style', account.speakingStyle],
          ['Expression Style', account.expressionStyle],
          ['Movement Style', account.movementStyle],
          ['Forbidden Rules', account.forbiddenRules],
        ].map(([label, value]) => value ? (
          <div key={label} className="border-b border-stone-100 py-2.5 last:border-0">
            <p className="text-xs text-stone-500 font-medium mb-0.5">{label}</p>
            <p className="text-sm text-stone-800 whitespace-pre-wrap">{value}</p>
          </div>
        ) : null)}
        {!account.characterDescription && !account.behavior && !account.speakingStyle && !account.expressionStyle && !account.movementStyle && !account.forbiddenRules && (
          <p className="text-sm text-stone-400 italic">Belum ada persona. Klik Edit untuk mengisi.</p>
        )}
      </div>

      {/* Foto Referensi */}
      {account.photoReferences.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-6 mb-6">
          <h2 className="text-base font-semibold text-stone-900 mb-4">Foto Referensi ({account.photoReferences.length})</h2>
          <div className="flex flex-wrap gap-3">
            {account.photoReferences.map(p => (
              <div key={p.id} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.thumbnailUrl ?? p.fileUrl}
                  alt={p.label}
                  className="w-20 h-20 object-cover rounded-lg border border-stone-200"
                />
                <p className="text-[10px] text-stone-400 mt-1 truncate w-20 text-center">{p.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title={`Edit @${account.username}`}>
        <form onSubmit={handleSaveAccount} className="space-y-4">
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
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Notes</label>
            <textarea
              value={accountForm.notes}
              onChange={(e) => setAccountForm({ ...accountForm, notes: e.target.value })}
              rows={2}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>
          <div className="border-t border-stone-100 pt-3">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Persona</p>
            {[
              { key: 'characterDescription', label: 'Deskripsi', placeholder: 'Siapa karakter ini? Latar belakang, kepribadian...' },
              { key: 'behavior', label: 'Behavior', placeholder: 'Cara berperilaku umum, tone, sikap...' },
              { key: 'speakingStyle', label: 'Speaking Style', placeholder: 'Gaya bicara, kata khas, panjang kalimat...' },
              { key: 'expressionStyle', label: 'Expression Style', placeholder: 'Ekspresi wajah, emosi yang sering ditampilkan...' },
              { key: 'movementStyle', label: 'Movement Style', placeholder: 'Gaya gerakan tubuh di depan kamera...' },
              { key: 'forbiddenRules', label: 'Forbidden Rules', placeholder: 'Topik, kata, klaim yang DILARANG muncul...' },
            ].map(({ key, label, placeholder }) => (
              <div key={key} className="mb-3">
                <label className="block text-sm font-medium text-stone-700 mb-1">{label}</label>
                <textarea
                  value={accountForm[key as keyof typeof accountForm]}
                  onChange={(e) => setAccountForm({ ...accountForm, [key]: e.target.value })}
                  rows={2}
                  placeholder={placeholder}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              </div>
            ))}
          </div>
          {saveAccountError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              ⚠️ {saveAccountError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setShowEditModal(false); setSaveAccountError(null) }} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={savingAccount} className="btn-success">
              {savingAccount ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  )
}
