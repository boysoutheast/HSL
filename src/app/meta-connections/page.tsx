'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import StatusBadge from '@/components/ui/StatusBadge'
import Table from '@/components/ui/Table'
import PageInfo from '@/components/ui/PageInfo'
import Modal from '@/components/ui/Modal'

interface MetaAccount {
  id: string
  name: string
  appId: string
  metaUserName: string | null
  status: string
  lastMetaCallAt: string | null
  businesses: unknown[]
  adAccounts: unknown[]
  pages: unknown[]
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

export default function MetaConnectionsPage() {
  const [accounts, setAccounts] = useState<MetaAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<MetaAccount | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Banner dari OAuth redirect (?connected=1 / ?error=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === '1') {
      setBanner({ type: 'ok', text: 'Facebook berhasil terhubung. Business, ad accounts, dan pages sudah disinkronkan.' })
    } else if (params.get('error')) {
      setBanner({ type: 'err', text: params.get('error') ?? 'Connect gagal' })
    }
    if (params.get('connected') || params.get('error')) {
      window.history.replaceState({}, '', '/meta-connections')
    }
  }, [])

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/meta-connections', { cache: 'no-store', credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setAccounts(data.metaAccounts ?? data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/admin/meta-connections/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `Server error (${res.status})`)
      }
      setDeleteTarget(null)
      await fetchAccounts()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div>
      {banner && (
        <div className={`mb-4 px-4 py-3 rounded-xl border text-sm flex items-center justify-between ${
          banner.type === 'ok'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          <span>{banner.type === 'ok' ? '✅' : '⚠️'} {banner.text}</span>
          <button onClick={() => setBanner(null)} className="text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Meta Akun</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {loading ? '...' : `${accounts.length} koneksi${accounts.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/admin/meta-oauth/start" className="btn-primary">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            Connect with Facebook
          </a>
          <Link href="/meta-connections/new" className="btn-ghost">
            Manual Token
          </Link>
        </div>
      </div>

      <PageInfo
        purpose="Kelola koneksi akun Meta (Business + Ads) yang terhubung ke sistem Hermes."
        wiring={[
          { label: '→ Businesses', desc: 'Business Manager yang terhubung' },
          { label: '→ Ad Accounts', desc: 'Akun Meta Ads yang bisa dipakai' },
          { label: '→ Pages', desc: 'Halaman Facebook & Instagram' },
          { label: '→ Test Launcher', desc: 'Dipakai saat launching campaign' },
        ]}
      />

      {loading ? (
        <div className="flex items-center justify-center h-48 text-stone-400 text-sm">Memuat...</div>
      ) : (
        <Table
          headers={['Nama', 'App ID', 'Meta User', 'Status', 'Last Call', 'Actions']}
          empty="Belum ada koneksi Meta. Klik &quot;Hubungkan Baru&quot; untuk mulai."
        >
          {accounts.map((acc) => (
            <tr key={acc.id} className="hover:bg-stone-50 transition-colors">
              <td className="px-4 py-3">
                <span className="font-medium text-stone-900">{acc.name}</span>
              </td>
              <td className="px-4 py-3 text-stone-600 font-mono text-xs">{acc.appId}</td>
              <td className="px-4 py-3 text-stone-700">{acc.metaUserName ?? '—'}</td>
              <td className="px-4 py-3">
                <MetaStatusBadge status={acc.status} />
              </td>
              <td className="px-4 py-3 text-stone-500 text-xs whitespace-nowrap">
                {formatDate(acc.lastMetaCallAt)}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Link href={`/meta-connections/${acc.id}`} className="btn-info btn-sm">
                    Detail →
                  </Link>
                  {(acc.status === 'needs_reconnect' || acc.status === 'expired' || acc.status === 'revoked') && (
                    <a href={`/api/admin/meta-oauth/start?reconnect=${acc.id}`} className="btn-primary btn-sm bg-amber-600 hover:bg-amber-700 border-amber-600">
                      Hubungkan Ulang
                    </a>
                  )}
                  <button
                    onClick={() => setDeleteTarget(acc)}
                    className="btn-danger btn-sm"
                  >
                    Hapus
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => { setDeleteTarget(null); setDeleteError(null) }}
        title="Hapus Koneksi Meta"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-stone-600">
            Hapus koneksi <strong>{deleteTarget?.name}</strong>? Tindakan ini tidak bisa dibatalkan.
          </p>
          {deleteError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              ⚠️ {deleteError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setDeleteTarget(null); setDeleteError(null) }}
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
