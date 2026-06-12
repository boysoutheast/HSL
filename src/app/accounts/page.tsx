'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import StatusBadge from '@/components/ui/StatusBadge'
import Table from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'

interface Account {
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
  _count?: { contentLogs: number }
}

const PERSONA_KEYS = ['characterDescription', 'behavior', 'speakingStyle', 'expressionStyle', 'movementStyle', 'forbiddenRules'] as const

const EMPTY_FORM = {
  username: '',
  accountName: '',
  gender: '',
  purpose: 'organic',
  notes: '',
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function PersonaDots({ account }: { account: Account }) {
  const filled = PERSONA_KEYS.filter(k => !!account[k]).length
  const color = filled === 0 ? 'text-red-400' : filled < 4 ? 'text-amber-500' : 'text-violet-600'
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {PERSONA_KEYS.map((k, i) => (
          <div key={i} className={`w-1.5 h-1.5 rounded-sm ${account[k] ? 'bg-violet-500' : 'bg-stone-200'}`} />
        ))}
      </div>
      <span className={`text-xs font-medium ${color}`}>{filled}/6</span>
    </div>
  )
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editAccount, setEditAccount] = useState<Account | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [toggleLoading, setToggleLoading] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/accounts', { cache: 'no-store', credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setAccounts(data.accounts ?? data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  const handleDeleteAccount = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/admin/accounts/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? `Server error (${res.status})`)
      setDeleteTarget(null)
      await fetchAccounts()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setDeleteLoading(false)
    }
  }

  const openAdd = () => {
    setEditAccount(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (account: Account) => {
    setEditAccount(account)
    setForm({
      username: account.username,
      accountName: account.accountName ?? '',
      gender: account.gender ?? '',
      purpose: account.purpose ?? 'organic',
      notes: account.notes ?? '',
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.username.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      const url = editAccount ? `/api/admin/accounts/${editAccount.id}` : '/api/admin/accounts'
      const method = editAccount ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: form.username.trim(),
          accountName: form.accountName.trim() || undefined,
          gender: form.gender || null,
          purpose: form.purpose || undefined,
          notes: form.notes.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 401) { window.location.href = '/login'; return }
        throw new Error(data?.error ?? `Server error (${res.status})`)
      }
      setShowModal(false)
      await fetchAccounts()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (account: Account) => {
    const newStatus = account.status === 'active' ? 'inactive' : 'active'
    setToggleLoading(account.id)
    try {
      const res = await fetch(`/api/admin/accounts/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error()
      setToggleError(null)
      setAccounts(prev => prev.map(a => a.id === account.id ? { ...a, status: newStatus } : a))
    } catch {
      setToggleError('Failed to update status.')
    } finally {
      setToggleLoading(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Instagram Accounts</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {loading ? '...' : `${accounts.length} account${accounts.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button onClick={openAdd} className="btn-primary">+ Add Account</button>
      </div>

      {toggleError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          ⚠️ {toggleError}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48 text-stone-400 text-sm">Loading accounts...</div>
      ) : (
        <Table
          headers={['Account', 'Gender', 'Purpose', 'Persona', 'Last Post', 'Status', 'Actions']}
          empty="No accounts found."
        >
          {accounts.map((account) => (
            <tr key={account.id} className="hover:bg-stone-50 transition-colors">
              <td className="px-4 py-3">
                <Link href={`/accounts/${account.id}`} className="font-semibold text-violet-700 hover:underline">
                  @{account.username}
                </Link>
                {account.accountName && (
                  <p className="text-xs text-stone-400 mt-0.5">{account.accountName}</p>
                )}
              </td>
              <td className="px-4 py-3">
                {account.gender === 'M' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">♂ M</span>
                )}
                {account.gender === 'F' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-pink-100 text-pink-700">♀ F</span>
                )}
                {!account.gender && <span className="text-stone-300 text-sm">—</span>}
              </td>
              <td className="px-4 py-3 text-stone-500 text-sm">{account.purpose ?? '—'}</td>
              <td className="px-4 py-3">
                <PersonaDots account={account} />
              </td>
              <td className="px-4 py-3 text-stone-500 text-sm whitespace-nowrap">{formatDate(account.lastPostAt)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={account.status} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/accounts/${account.id}`} className="btn-info btn-sm">Detail →</Link>
                  <button onClick={() => openEdit(account)} className="btn-warning btn-sm">Edit</button>
                  <button
                    onClick={() => toggleStatus(account)}
                    disabled={toggleLoading === account.id}
                    className={account.status === 'active' ? 'btn-ghost btn-sm' : 'btn-success btn-sm'}
                  >
                    {toggleLoading === account.id ? '...' : account.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => { setDeleteTarget(account); setDeleteError(null) }}
                    disabled={deleteLoading}
                    className="btn-danger btn-sm"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setSaveError(null) }}
        title={editAccount ? `Edit @${editAccount.username}` : 'Add Account'}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Username <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="tanpa @ — contoh: mybrand_id"
                required
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Account Name</label>
              <input
                type="text"
                value={form.accountName}
                onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                placeholder="Display name"
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Gender</label>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
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
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
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
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional notes..."
              rows={2}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>
          {!editAccount && (
            <p className="text-xs text-stone-400">Persona bisa diisi dari halaman detail akun setelah dibuat.</p>
          )}
          {saveError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              ⚠️ {saveError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={() => { setShowModal(false); setSaveError(null) }} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving || !form.username.trim()} className="btn-primary">
              {saving ? 'Saving...' : editAccount ? 'Save Changes' : 'Add Account'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => { setDeleteTarget(null); setDeleteError(null) }}
        title="Hapus Akun"
      >
        <div className="space-y-4">
          <p className="text-sm text-stone-600">
            Hapus akun <strong>@{deleteTarget?.username}</strong>? Tindakan ini tidak bisa dibatalkan dan akan menghapus semua foto referensi, topik, CEP, dan assignment terkait.
          </p>
          {deleteError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              ⚠️ {deleteError}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => { setDeleteTarget(null); setDeleteError(null) }} className="btn-ghost">Batal</button>
            <button onClick={handleDeleteAccount} disabled={deleteLoading} className="btn-danger">
              {deleteLoading ? 'Menghapus...' : 'Ya, Hapus'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
