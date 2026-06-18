'use client'

import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'

interface AddAccountModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  editAccount?: {
    id: string
    username: string
    accountName: string | null
    gender: string | null
    purpose: string | null
    notes: string | null
  } | null
}

const EMPTY_FORM = {
  username: '',
  accountName: '',
  gender: '',
  purpose: 'organic',
  notes: '',
}

export default function AddAccountModal({ open, onClose, onSuccess, editAccount }: AddAccountModalProps) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (!open) return
    if (editAccount) {
      setForm({
        username: editAccount.username,
        accountName: editAccount.accountName ?? '',
        gender: editAccount.gender ?? '',
        purpose: editAccount.purpose ?? 'organic',
        notes: editAccount.notes ?? '',
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setSaveError(null)
  }, [open, editAccount])

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
      onClose()
      onSuccess()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setSaveError(null)
    onClose()
  }

  // Reset form when modal opens
  if (open && form === EMPTY_FORM && !editAccount) {
    // already default
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={editAccount ? `Edit @${editAccount.username}` : 'Add Account'}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Username <span className="text-red-500">*</span>
            </label>
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
          <button type="button" onClick={handleClose} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={saving || !form.username.trim()} className="btn-primary">
            {saving ? 'Saving...' : editAccount ? 'Save Changes' : 'Add Account'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
