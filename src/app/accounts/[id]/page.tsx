'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import StatusBadge from '@/components/ui/StatusBadge'
import Table from '@/components/ui/Table'
import PageInfo from '@/components/ui/PageInfo'
import Modal from '@/components/ui/Modal'

interface Character {
  id: string
  name: string
  status: string
  description: string
}

interface PostingMonitor {
  id: string
  status: string
  currentViews: number
  growthPerHour: number
  lastPostAt: string | null
  reason: string | null
  hermesAgent: { name: string } | null
}

interface AccountDetail {
  id: string
  username: string
  accountName: string | null
  status: string
  purpose: string | null
  notes: string | null
  lastPostAt: string | null
  createdAt: string
  characters: Character[]
  postingMonitor: PostingMonitor | null
  _count?: { assignments: number }
}

const EMPTY_ACCOUNT_FORM = {
  username: '',
  accountName: '',
  purpose: 'organic',
  notes: '',
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
  const [showAddChar, setShowAddChar] = useState(false)
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT_FORM)
  const [newChar, setNewChar] = useState({ name: '', description: '', topicsRaw: '' })
  const [charPhoto, setCharPhoto] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [savingAccount, setSavingAccount] = useState(false)
  const [addCharLoading, setAddCharLoading] = useState(false)
  const [saveAccountError, setSaveAccountError] = useState<string | null>(null)
  const [deleteCharLoading, setDeleteCharLoading] = useState<string | null>(null)

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

  const handleDeleteChar = async (charId: string, charName: string) => {
    if (!confirm(`Hapus karakter "${charName}" beserta semua topik, foto, dan CEP-nya?\n\nTidak bisa dibatalkan.`)) return
    setDeleteCharLoading(charId)
    try {
      const res = await fetch(`/api/admin/characters/${charId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error((await res.json()).error)
      await fetchAccount()
    } catch (err) {
      alert('Gagal hapus: ' + String(err))
    } finally {
      setDeleteCharLoading(null)
    }
  }

  const openEditAccount = () => {
    if (!account) return
    setAccountForm({
      username: account.username,
      accountName: account.accountName ?? '',
      purpose: account.purpose ?? 'organic',
      notes: account.notes ?? '',
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
          purpose: accountForm.purpose || undefined,
          notes: accountForm.notes.trim() || undefined,
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

  const handleAddChar = async () => {
    if (!newChar.name.trim()) return
    setAddCharLoading(true)
    try {
      // Step 1: Create character
      const res = await fetch('/api/admin/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          instagramAccountId: accountId,
          name: newChar.name.trim(),
          description: newChar.description.trim() || null,
          status: 'active',
        }),
      })
      if (!res.ok) throw new Error('Gagal membuat karakter')
      const data = await res.json()
      const character = data.character ?? data

      // Step 2: Upload foto jika ada
      if (charPhoto) {
        const fd = new FormData()
        fd.append('file', charPhoto)
        fd.append('characterId', character.id)
        fd.append('label', newChar.name.trim())
        fd.append('category', 'portrait')
        await fetch('/api/photos/upload', { method: 'POST', credentials: 'include', body: fd })
      }

      // Step 3: Buat topik awal (jika ada)
      const topicNames = newChar.topicsRaw.split('\n').map(t => t.trim()).filter(Boolean)
      if (topicNames.length > 0) {
        await Promise.all(
          topicNames.map(name =>
            fetch('/api/admin/topics', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ characterId: character.id, name, status: 'active' }),
            })
          )
        )
      }

      setShowAddChar(false)
      setNewChar({ name: '', description: '', topicsRaw: '' })
      setCharPhoto(null)
      await fetchAccount()
    } catch (err) {
      alert('Error: ' + String(err))
    } finally {
      setAddCharLoading(false)
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
        purpose={`Detail akun @${account.username} — status monitor, karakter yang dimiliki, dan relasi ke Hermes Agent.`}
        wiring={[
          { label: '→ Posting Monitor', desc: 'status real-time akun ini' },
          { label: '→ Characters', desc: `${account.characters.length} karakter terdaftar — klik nama untuk drill-down` },
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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

      {/* Characters */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-stone-900">
            Characters ({account.characters.length})
          </h2>
          <button onClick={() => { setNewChar({ name: '', description: '', topicsRaw: '' }); setCharPhoto(null); setShowAddChar(true) }} className="btn-primary">
            + Add Character
          </button>
        </div>

        <Table
          headers={['Name', 'Status', 'Description', 'Actions']}
          empty="No characters yet. Add one to get started."
        >
          {account.characters.map((char) => (
            <tr key={char.id} className="hover:bg-stone-50">
              <td className="px-4 py-3">
                <Link
                  href={`/accounts/${account.id}/characters/${char.id}`}
                  className="font-medium text-violet-700 hover:underline"
                >
                  {char.name}
                </Link>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={char.status} />
              </td>
              <td className="px-4 py-3 text-stone-500 max-w-sm truncate">{char.description}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/accounts/${account.id}/characters/${char.id}`}
                    className="btn-info btn-sm"
                  >
                    Detail →
                  </Link>
                  <button
                    onClick={() => handleDeleteChar(char.id, char.name)}
                    disabled={deleteCharLoading === char.id}
                    className="btn-danger btn-sm"
                  >
                    {deleteCharLoading === char.id ? '...' : 'Delete'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </div>

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
              rows={3}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
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

      {/* Add Character Modal */}
      {showAddChar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-stone-900">Tambah Karakter</h2>
              <button onClick={() => setShowAddChar(false)} className="text-stone-400 hover:text-stone-600 text-xl leading-none">×</button>
            </div>

            {/* 1. Upload Foto */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Foto Karakter</label>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault(); setDragOver(false)
                  const file = e.dataTransfer.files[0]
                  if (file && file.type.startsWith('image/')) setCharPhoto(file)
                }}
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                  dragOver ? 'border-violet-400 bg-violet-50' : 'border-stone-300 hover:border-violet-300'
                }`}
                onClick={() => document.getElementById('char-photo-input')?.click()}
              >
                {charPhoto ? (
                  <div className="flex items-center justify-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={URL.createObjectURL(charPhoto)} alt="preview" className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-stone-700">{charPhoto.name}</p>
                      <button
                        onClick={e => { e.stopPropagation(); setCharPhoto(null) }}
                        className="text-xs text-red-500 hover:text-red-700 mt-0.5"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-stone-400 space-y-1 py-2">
                    <p className="text-2xl">📷</p>
                    <p className="text-sm">Drag & drop atau klik untuk upload</p>
                    <p className="text-xs">JPG, PNG, WEBP</p>
                  </div>
                )}
              </div>
              <input
                id="char-photo-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => setCharPhoto(e.target.files?.[0] ?? null)}
              />
            </div>

            {/* 2. Nama */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Nama Karakter <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newChar.name}
                onChange={e => setNewChar({ ...newChar, name: e.target.value })}
                placeholder="Misal: Ibu Sari, Tante Dewi"
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            {/* 3. Persona */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Persona</label>
              <textarea
                value={newChar.description}
                onChange={e => setNewChar({ ...newChar, description: e.target.value })}
                rows={4}
                placeholder="Siapa karakter ini? Latar belakang, kepribadian, cara bicara, target audiens yang relate..."
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              />
            </div>

            {/* 4. Topik Awal */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Topik Awal
                <span className="text-xs text-stone-400 font-normal ml-1">(pisahkan dengan Enter)</span>
              </label>
              <textarea
                value={newChar.topicsRaw}
                onChange={e => setNewChar({ ...newChar, topicsRaw: e.target.value })}
                rows={3}
                placeholder={"Kaki kering diabetes\nEmotional keluarga\nSocial embarrassment"}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none font-mono text-xs"
              />
              <p className="text-xs text-stone-400 mt-1">
                Topik bisa ditambah / diedit lagi di halaman detail karakter.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowAddChar(false)} className="btn-ghost flex-1">
                Cancel
              </button>
              <button
                onClick={handleAddChar}
                disabled={addCharLoading || !newChar.name.trim()}
                className="btn-primary flex-1"
              >
                {addCharLoading ? 'Menyimpan...' : 'Buat Karakter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
