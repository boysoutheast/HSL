'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import StatusBadge from '@/components/ui/StatusBadge'
import Table from '@/components/ui/Table'
import PageInfo from '@/components/ui/PageInfo'
import Modal from '@/components/ui/Modal'

interface Business {
  businessId: string
  businessName: string
  verificationStatus: string | null
  isSelected?: boolean
}

interface AdAccount {
  adAccountId: string
  adAccountName?: string
  name?: string
  accountStatus?: string
  status?: string
  currency: string | null
  timezoneName?: string | null
  isDefault?: boolean
}

interface Page {
  pageId?: string
  pageName: string
  igBusinessAccountId?: string | null
  igUsername?: string | null
  igName?: string | null
  isActive?: boolean
}

interface MetaConnection {
  id: string
  name: string
  appId: string
  metaUserId?: string
  metaUserName?: string | null
  status: string
  lastMetaCallAt: string | null
  scopes?: string[]
  tokenExpiry?: string | null
  accountName?: string | null
  notes?: string | null
  defaultAdAccountId?: string | null
  businesses: Business[]
  adAccounts: AdAccount[]
  pages: Page[]
}

function MetaStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    connected: 'badge-connected',
    expired: 'badge-expired',
    needs_reconnect: 'badge-reconnect',
    revoked: 'badge-revoked',
  }
  const label: Record<string, string> = {
    connected: 'Connected',
    expired: 'Expired',
    needs_reconnect: 'Needs Reconnect',
    revoked: 'Revoked',
  }
  const cls = map[status] ?? 'badge-inactive'
  const text = label[status] ?? status
  return <span className={cls}>{text}</span>
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const inputCls = 'w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500'

export default function MetaConnectionDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [conn, setConn] = useState<MetaConnection | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [deleteModal, setDeleteModal] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Edit state
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editAppId, setEditAppId] = useState('')
  const [editAccountName, setEditAccountName] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Credential modal
  const [credModal, setCredModal] = useState(false)
  const [credAppSecret, setCredAppSecret] = useState('')
  const [credToken, setCredToken] = useState('')
  const [credTesting, setCredTesting] = useState(false)
  const [credError, setCredError] = useState<string | null>(null)
  const [credStep, setCredStep] = useState<'input' | 'test' | 'saving' | 'done'>('input')
  const [credTestResult, setCredTestResult] = useState<{ metaUserId?: string; metaUserName?: string; scopes?: string[]; tokenExpiry?: string } | null>(null)

  const fetchConnection = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/meta-connections/${id}`, { cache: 'no-store', credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const conn = data.metaAccount ?? data
      setConn(conn)
      if (conn) {
        // Pre-populate edit fields
        setEditName(conn.name ?? '')
        setEditAppId(conn.appId ?? '')
        setEditAccountName(conn.accountName ?? '')
        setEditNotes(conn.notes ?? '')
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchConnection() }, [fetchConnection])

  // ── Sync Asset handlers ──
  const handleSyncAssets = async () => {
    setSyncing(true)
    setSyncError(null)
    try {
      const res = await fetch(`/api/admin/meta-connections/${id}/sync-assets`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `Server error (${res.status})`)
      }
      await fetchConnection()
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSyncing(false)
    }
  }

  // ── Delete handlers ──
  const handleDelete = async () => {
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/admin/meta-connections/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `Server error (${res.status})`)
      }
      window.location.href = '/meta-connections'
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Unknown error')
      setDeleteLoading(false)
    }
  }

  // ── Edit handlers ──
  const startEdit = () => {
    setEditing(true)
    setEditName(conn?.name ?? '')
    setEditAppId(conn?.appId ?? '')
    setEditAccountName(conn?.accountName ?? '')
    setEditNotes(conn?.notes ?? '')
    setEditError(null)
  }

  const cancelEdit = () => {
    setEditing(false)
    setEditError(null)
  }

  const saveEdit = async () => {
    setEditSaving(true)
    setEditError(null)
    try {
      const res = await fetch(`/api/admin/meta-connections/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          appId: editAppId.trim(),
          accountName: editAccountName.trim() || null,
          notes: editNotes.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `Server error (${res.status})`)
      }
      setEditing(false)
      await fetchConnection()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setEditSaving(false)
    }
  }

  // ── Credential handlers ──
  const openCredModal = () => {
    setCredModal(true)
    setCredStep('input')
    setCredAppSecret('')
    setCredToken('')
    setCredError(null)
    setCredTestResult(null)
  }

  const testCredentials = async () => {
    if (!credAppSecret.trim() || !credToken.trim()) return
    setCredTesting(true)
    setCredError(null)
    setCredStep('test')
    try {
      const res = await fetch(`/api/admin/meta-connections/${id}/credentials`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appSecret: credAppSecret.trim(),
          userAccessToken: credToken.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error ?? `Server error (${res.status})`)
      }
      setCredTestResult({
        metaUserId: data.metaAccount?.metaUserId,
        metaUserName: data.metaAccount?.metaUserName,
        scopes: data.metaAccount?.scopesJson ? JSON.parse(data.metaAccount.scopesJson) : [],
        tokenExpiry: data.metaAccount?.tokenExpiry,
      })
      setCredStep('done')
    } catch (err) {
      setCredStep('input')
      setCredError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setCredTesting(false)
    }
  }

  const closeCredModal = () => {
    setCredModal(false)
    if (credStep === 'done') {
      fetchConnection()
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-stone-400 text-sm">Memuat...</div>
  }

  if (!conn) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-stone-500">Koneksi tidak ditemukan.</p>
        <Link href="/system?tab=connections" className="text-sm text-violet-600 hover:underline">
          Kembali ke Meta Akun
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2">
        <Link href="/system?tab=connections" className="text-sm text-stone-500 hover:text-stone-700">
          Meta Akun
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-stone-900">{conn.name}</span>
      </div>

      {/* Header Card — Edit Mode */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Nama Koneksi</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className={inputCls}
                    placeholder="Nama koneksi"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">App ID</label>
                  <input
                    type="text"
                    value={editAppId}
                    onChange={e => setEditAppId(e.target.value)}
                    className={inputCls}
                    placeholder="App ID dari Meta Developer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Account Name</label>
                  <input
                    type="text"
                    value={editAccountName}
                    onChange={e => setEditAccountName(e.target.value)}
                    className={inputCls}
                    placeholder="Nama account (opsional)"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Notes</label>
                  <textarea
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    className={`${inputCls} resize-none`}
                    rows={2}
                    placeholder="Catatan internal (opsional)"
                  />
                </div>
                {editError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">⚠️ {editError}</div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={saveEdit} disabled={editSaving} className="btn-success btn-sm">
                    {editSaving ? 'Menyimpan...' : 'Simpan'}
                  </button>
                  <button onClick={cancelEdit} disabled={editSaving} className="btn-secondary btn-sm">
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-stone-900">{conn.name}</h1>
                {conn.metaUserName && (
                  <p className="text-stone-600 mt-0.5">{conn.metaUserName}</p>
                )}
              </>
            )}
          </div>
          {!editing && (
            <div className="flex items-center gap-3 shrink-0 ml-4">
              <MetaStatusBadge status={conn.status} />
              <button onClick={startEdit} className="btn-secondary btn-sm">
                ✏️ Edit
              </button>
              <Link href="/meta-connections/new" className="btn-ghost btn-sm">
                + Hubungkan Baru
              </Link>
            </div>
          )}
        </div>

        {!editing && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">App ID</p>
                <p className="font-mono text-stone-800 text-xs">{conn.appId}</p>
              </div>
              {conn.metaUserId && (
                <div>
                  <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Meta User ID</p>
                  <p className="font-mono text-stone-800 text-xs">{conn.metaUserId}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Last Call</p>
                <p className="text-stone-800">{formatDate(conn.lastMetaCallAt)}</p>
              </div>
              {conn.tokenExpiry && (
                <div>
                  <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-1">Token Expiry</p>
                  <p className="text-stone-800">{formatDate(conn.tokenExpiry)}</p>
                </div>
              )}
            </div>

            {conn.scopes && conn.scopes.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-2">Scopes</p>
                <div className="flex flex-wrap gap-1.5">
                  {conn.scopes.map((scope) => (
                    <span key={scope} className="bg-violet-100 text-violet-700 text-xs px-2 py-0.5 rounded-full font-medium">
                      {scope}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4">
              <button
                onClick={handleSyncAssets}
                disabled={syncing}
                className="btn-primary"
              >
                {syncing ? '🔄 Menyinkronkan...' : '🔄 Sync Assets'}
              </button>
              <button
                onClick={openCredModal}
                className="btn-secondary"
              >
                🔄 Perbarui Kredensial
              </button>
              {syncError && (
                <span className="text-sm text-red-600">⚠️ {syncError}</span>
              )}
              <span className="text-xs text-stone-400">
                Sinkronkan Businesses, Ad Accounts, dan Pages dari Meta API
              </span>
            </div>
          </>
        )}
      </div>

      {/* Businesses */}
      <div className="mb-8">
        <h2 className="text-base font-semibold text-stone-900 mb-3">
          Businesses ({conn.businesses?.length ?? 0})
        </h2>
        <Table
          headers={['Business ID', 'Business Name', 'Verification Status']}
          empty="Belum ada business yang terhubung."
        >
          {conn.businesses?.map((biz) => (
            <tr key={biz.businessId} className="hover:bg-stone-50">
              <td className="px-4 py-3 font-mono text-xs text-stone-700">{biz.businessId}</td>
              <td className="px-4 py-3 text-stone-800">{biz.businessName}</td>
              <td className="px-4 py-3">
                {biz.verificationStatus ? (
                  <StatusBadge status={biz.verificationStatus} />
                ) : (
                  <span className="text-stone-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </div>

      {/* Ad Accounts */}
      <div className="mb-8">
        <h2 className="text-base font-semibold text-stone-900 mb-3">
          Ad Accounts ({conn.adAccounts?.length ?? 0})
        </h2>
        <Table
          headers={['Ad Account ID', 'Nama', 'Status', 'Currency']}
          empty="Belum ada ad account yang terhubung."
        >
          {conn.adAccounts?.map((acc) => {
            const adAccountId = acc.adAccountId
            const name = acc.adAccountName || acc.name || adAccountId
            const status = acc.accountStatus || acc.status || 'unknown'
            return (
              <tr key={adAccountId} className="hover:bg-stone-50">
                <td className="px-4 py-3 font-mono text-xs text-stone-700">{adAccountId}</td>
                <td className="px-4 py-3 text-stone-800">{name}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={status} />
                </td>
                <td className="px-4 py-3 text-stone-600">{acc.currency ?? '—'}</td>
              </tr>
            )
          })}
        </Table>
      </div>

      {/* Pages */}
      <div className="mb-8">
        <h2 className="text-base font-semibold text-stone-900 mb-3">
          Pages ({conn.pages?.length ?? 0})
        </h2>
        <Table
          headers={['Page Name', 'Instagram Username', 'Instagram Name', 'Active']}
          empty="Belum ada page yang terhubung."
        >
          {conn.pages?.map((pg) => (
            <tr key={pg.pageId || pg.pageName} className="hover:bg-stone-50">
              <td className="px-4 py-3 text-stone-800">{pg.pageName}</td>
              <td className="px-4 py-3 text-stone-600">{pg.igUsername ?? '—'}</td>
              <td className="px-4 py-3 text-stone-600">{pg.igName ?? '—'}</td>
              <td className="px-4 py-3">
                {pg.isActive !== undefined ? (
                  <span className={pg.isActive ? 'text-green-600' : 'text-stone-400'}>
                    {pg.isActive ? '✓' : '—'}
                  </span>
                ) : (
                  <span className="text-stone-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <h2 className="text-base font-semibold text-red-700 mb-1">Danger Zone</h2>
        <p className="text-sm text-stone-500 mb-4">
          Menghapus koneksi tidak akan menghapus data assets yang sudah disinkronkan.
        </p>
        <button
          onClick={() => setDeleteModal(true)}
          className="btn-danger btn-sm"
        >
          Hapus Koneksi
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModal}
        onClose={() => { setDeleteModal(false); setDeleteError(null) }}
        title="Hapus Koneksi Meta"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-stone-600">
            Hapus koneksi <strong>{conn.name}</strong>? Tindakan ini tidak bisa dibatalkan.
          </p>
          {deleteError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              ⚠️ {deleteError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setDeleteModal(false); setDeleteError(null) }}
              className="btn-secondary"
            >
              Batal
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteLoading}
              className="btn-danger"
            >
              {deleteLoading ? 'Menghapus...' : 'Ya, Hapus'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Perbarui Kredensial Modal */}
      <Modal
        open={credModal}
        onClose={closeCredModal}
        title="Perbarui Kredensial Meta"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          {credStep === 'input' && (
            <>
              <p className="text-sm text-stone-500">
                Masukkan App Secret dan Token baru untuk <strong>{conn.name}</strong>. 
                Keduanya akan diverifikasi dan dienkripsi sebelum disimpan.
              </p>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  App Secret <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={credAppSecret}
                  onChange={e => setCredAppSecret(e.target.value)}
                  placeholder="App Secret dari Meta Developer Console"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  User Access Token <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={credToken}
                  onChange={e => setCredToken(e.target.value)}
                  placeholder="Token baru dari Meta Graph API Explorer"
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
              </div>
              {credError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">⚠️ {credError}</div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={closeCredModal} className="btn-secondary">Batal</button>
                <button
                  onClick={testCredentials}
                  disabled={credTesting || !credAppSecret.trim() || !credToken.trim()}
                  className="btn-primary"
                >
                  {credTesting ? 'Memverifikasi...' : 'Verifikasi & Simpan'}
                </button>
              </div>
            </>
          )}

          {credStep === 'done' && (
            <>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-2xl">✓</div>
                <div>
                  <h3 className="text-base font-semibold text-stone-900">Kredensial Diperbarui</h3>
                  <p className="text-sm text-stone-500">Token baru berhasil diverifikasi dan disimpan</p>
                </div>
              </div>
              {credTestResult && credTestResult.scopes && credTestResult.scopes.length > 0 && (
                <div className="bg-stone-50 rounded-lg p-4">
                  <p className="text-xs text-stone-500 uppercase tracking-wide font-medium mb-2">Scopes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {credTestResult.scopes.map((scope: string) => (
                      <span key={scope} className="bg-violet-100 text-violet-700 text-xs px-2 py-0.5 rounded-full font-medium">
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {credTestResult?.tokenExpiry && (
                <div className="text-sm text-stone-600">
                  Token Expiry: <span className="font-medium">{formatDate(credTestResult.tokenExpiry)}</span>
                </div>
              )}
              <div className="flex justify-end pt-2">
                <button onClick={closeCredModal} className="btn-primary">Selesai</button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
