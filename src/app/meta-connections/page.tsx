'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import StatusBadge from '@/components/ui/StatusBadge'
import Table from '@/components/ui/Table'

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
          <h1 className="text-2xl font-bold text-stone-900">Akun Meta</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {loading ? '...' : `${accounts.length} koneksi${accounts.length !== 1 ? '' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/admin/meta-oauth/start" className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Hubungkan Meta
          </a>
          <Link href="/meta-connections/new" className="btn-secondary">
            Tambah manual
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-stone-400 text-sm">Memuat...</div>
      ) : (
        <Table
          headers={['Nama Koneksi', 'Status', 'Ad Account', 'Terakhir Sinkron', '']}
          empty="Belum ada koneksi Meta. Klik &quot;Hubungkan Meta&quot; untuk mulai."
        >
          {accounts.map((acc) => (
            <tr key={acc.id} className="hover:bg-stone-50 transition-colors">
              <td className="px-4 py-3">
                <span className="font-medium text-stone-900">{acc.name}</span>
              </td>
              <td className="px-4 py-3">
                <MetaStatusBadge status={acc.status} />
              </td>
              <td className="px-4 py-3 text-stone-600 text-sm">
                {Array.isArray(acc.adAccounts) ? `${acc.adAccounts.length} akun` : '—'}
              </td>
              <td className="px-4 py-3 text-stone-500 text-xs whitespace-nowrap">
                {formatDate(acc.lastMetaCallAt)}
              </td>
              <td className="px-4 py-3 text-right">
                <Link href={`/meta-connections/${acc.id}`} className="btn-info btn-sm whitespace-nowrap">
                  Kelola →
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
