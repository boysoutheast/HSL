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

  const fetchConnection = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/meta-connections/${id}`, { cache: 'no-store', credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setConn(data.metaAccount ?? data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchConnection() }, [fetchConnection])

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

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Memuat...</div>
  }

  if (!conn) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-gray-500">Koneksi tidak ditemukan.</p>
        <Link href="/meta-connections" className="text-sm text-indigo-600 hover:underline">
          Kembali ke Meta Akun
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2">
        <Link href="/meta-connections" className="text-sm text-gray-500 hover:text-gray-700">
          Meta Akun
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-gray-900">{conn.name}</span>
      </div>

      {/* Header Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{conn.name}</h1>
            {conn.metaUserName && (
              <p className="text-gray-600 mt-0.5">{conn.metaUserName}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <MetaStatusBadge status={conn.status} />
            <Link href="/meta-connections/new" className="btn-primary btn-sm">
              + Hubungkan Baru
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">App ID</p>
            <p className="font-mono text-gray-800 text-xs">{conn.appId}</p>
          </div>
          {conn.metaUserId && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Meta User ID</p>
              <p className="font-mono text-gray-800 text-xs">{conn.metaUserId}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Last Call</p>
            <p className="text-gray-800">{formatDate(conn.lastMetaCallAt)}</p>
          </div>
          {conn.tokenExpiry && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Token Expiry</p>
              <p className="text-gray-800">{formatDate(conn.tokenExpiry)}</p>
            </div>
          )}
        </div>

        {conn.scopes && conn.scopes.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">Scopes</p>
            <div className="flex flex-wrap gap-1.5">
              {conn.scopes.map((scope) => (
                <span key={scope} className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium">
                  {scope}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sync Button */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4">
          <button
            onClick={handleSyncAssets}
            disabled={syncing}
            className="btn-primary"
          >
            {syncing ? '🔄 Menyinkronkan...' : '🔄 Sync Assets'}
          </button>
          {syncError && (
            <span className="text-sm text-red-600">⚠️ {syncError}</span>
          )}
          <span className="text-xs text-gray-400">
            Sinkronkan Businesses, Ad Accounts, dan Pages dari Meta API
          </span>
        </div>
      </div>

      {/* Businesses */}
      <div className="mb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-3">
          Businesses ({conn.businesses?.length ?? 0})
        </h2>
        <Table
          headers={['Business ID', 'Business Name', 'Verification Status']}
          empty="Belum ada business yang terhubung."
        >
          {conn.businesses?.map((biz) => (
            <tr key={biz.businessId} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-mono text-xs text-gray-700">{biz.businessId}</td>
              <td className="px-4 py-3 text-gray-800">{biz.businessName}</td>
              <td className="px-4 py-3">
                {biz.verificationStatus ? (
                  <StatusBadge status={biz.verificationStatus} />
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </div>

      {/* Ad Accounts */}
      <div className="mb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-3">
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
              <tr key={adAccountId} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{adAccountId}</td>
                <td className="px-4 py-3 text-gray-800">{name}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={status} />
                </td>
                <td className="px-4 py-3 text-gray-600">{acc.currency ?? '—'}</td>
              </tr>
            )
          })}
        </Table>
      </div>

      {/* Pages */}
      <div className="mb-8">
        <h2 className="text-base font-semibold text-gray-900 mb-3">
          Pages ({conn.pages?.length ?? 0})
        </h2>
        <Table
          headers={['Page Name', 'Instagram Username', 'Instagram Name', 'Active']}
          empty="Belum ada page yang terhubung."
        >
          {conn.pages?.map((pg) => (
            <tr key={pg.pageId || pg.pageName} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-800">{pg.pageName}</td>
              <td className="px-4 py-3 text-gray-600">{pg.igUsername ?? '—'}</td>
              <td className="px-4 py-3 text-gray-600">{pg.igName ?? '—'}</td>
              <td className="px-4 py-3">
                {pg.isActive !== undefined ? (
                  <span className={pg.isActive ? 'text-green-600' : 'text-gray-400'}>
                    {pg.isActive ? '✓' : '—'}
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <h2 className="text-base font-semibold text-red-700 mb-1">Danger Zone</h2>
        <p className="text-sm text-gray-500 mb-4">
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
          <p className="text-sm text-gray-600">
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
              className="btn-ghost"
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
    </div>
  )
}
