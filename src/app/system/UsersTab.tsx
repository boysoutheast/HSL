'use client'

import { useEffect, useState, useCallback } from 'react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface UserRow {
  id: string; email: string; name: string | null
  role: string; status: string; creditBalance: number
  lastLoginAt: string | null; createdAt: string
  _count: { campaignSessions: number; generatedMedia: number; apiKeys: number; metaAccounts: number }
}

interface UserDetail {
  user: { id: string; email: string; name: string | null; role: string; status: string; creditBalance: number; lastLoginAt: string | null; createdAt: string }
  credits: { balance: number; granted: number; consumed: number; transactions: Array<{ id: string; amount: number; reason: string; createdAt: string; balanceAfter: number }> }
  usage: { videos: { total: number; completed: number; failed: number }; campaigns: { total: number; running: number }; apiKeys: Array<{ id: string; prefix: string; status: string; lastUsedAt: string | null }>; metaAccounts: number; spendAllTime: number }
}

function fmtRp(n: number): string {
  if (n >= 1_000_000) return 'Rp' + (n / 1_000_000).toFixed(1) + 'jt'
  if (n >= 1_000) return 'Rp' + (n / 1_000).toFixed(0) + 'rb'
  return 'Rp' + n.toLocaleString()
}

function timeAgo(d: string | null): string {
  if (!d) return '—'
  const ms = Date.now() - new Date(d).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'baru'
  if (m < 60) return m + 'm'
  const h = Math.floor(m / 60)
  if (h < 24) return h + 'j'
  return Math.floor(h / 24) + 'h'
}

function statusBadge(s: string) {
  const colors: Record<string, string> = { active: 'bg-emerald-100 text-emerald-700', pending: 'bg-amber-100 text-amber-700', suspended: 'bg-red-100 text-red-700' }
  return <span className={'text-[10px] font-bold px-1.5 py-0.5 rounded ' + (colors[s] ?? 'bg-stone-100 text-stone-500')}>{s}</span>
}

export default function UsersTab() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [sortBy, setSortBy] = useState('recent')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState<{userId: string; keyId: string} | null>(null)
  const limit = 20

  const loadUsers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(limit), sort: sortBy })
    if (q) params.set('q', q)
    if (statusFilter) params.set('status', statusFilter)
    if (roleFilter) params.set('role', roleFilter)
    try {
      const r = await fetch('/api/admin/admin-users?' + params, { credentials: 'include' })
      const d = await r.json()
      if (r.ok) { setUsers(d.users); setTotal(d.meta.total) }
    } catch {}
    setLoading(false)
  }, [page, q, statusFilter, roleFilter, sortBy])

  useEffect(() => { loadUsers() }, [loadUsers])

  const openDrawer = async (userId: string) => {
    setSelectedUserId(userId)
    setDetailLoading(true)
    try {
      const r = await fetch('/api/admin/admin-users/' + userId, { credentials: 'include' })
      const d = await r.json()
      if (r.ok) setDetail(d)
    } catch {}
    setDetailLoading(false)
  }

  const doAction = async (userId: string, data: Record<string, string>) => {
    try {
      const r = await fetch('/api/admin/admin-users/' + userId, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!r.ok) { const d = await r.json(); alert(d.error); return }
      loadUsers()
      if (detail?.user.id === userId) openDrawer(userId)
    } catch (e) { alert(String(e)) }
  }

  const revokeKey = (userId: string, keyId: string) => {
    setConfirmRevoke({ userId, keyId })
  }

  const revokeKeyConfirm = async () => {
    if (!confirmRevoke) return
    const { userId, keyId } = confirmRevoke
    setConfirmRevoke(null)
    try {
      const r = await fetch('/api/admin/admin-users/' + userId + '/api-keys/' + keyId, { method: 'DELETE', credentials: 'include' })
      if (!r.ok) { const d = await r.json(); alert(d.error); return }
      if (detail?.user.id === userId) openDrawer(userId)
    } catch (e) { alert(String(e)) }
  }

  const grantCredits = async (userId: string) => {
    const amount = prompt('Jumlah kredit:', '100000')
    if (!amount) return
    const reason = prompt('Alasan:', 'Top-up')
    if (!reason) return
    try {
      const r = await fetch('/api/admin/credits/grant', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, amount: parseInt(amount), reason }) })
      if (!r.ok) { const d = await r.json(); alert(d.error); return }
      if (detail?.user.id === userId) openDrawer(userId)
    } catch (e) { alert(String(e)) }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="flex h-full">
      {/* Table */}
      <div className={'flex-1 min-w-0 ' + (selectedUserId ? 'hidden lg:block' : '')}>
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <input value={q} onChange={e => { setQ(e.target.value); setPage(1) }} placeholder="Cari email/nama..." className="px-3 py-1.5 text-xs border border-stone-200 rounded-lg w-48 focus:outline-none focus:border-violet-400" />
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="px-2 py-1.5 text-xs border border-stone-200 rounded-lg"><option value="">Semua status</option><option value="active">Active</option><option value="pending">Pending</option><option value="suspended">Suspended</option></select>
          <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1) }} className="px-2 py-1.5 text-xs border border-stone-200 rounded-lg"><option value="">Semua role</option><option value="user">User</option><option value="admin">Admin</option></select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="px-2 py-1.5 text-xs border border-stone-200 rounded-lg"><option value="recent">Terbaru</option><option value="balance">Saldo ↓</option></select>
          <span className="text-xs text-stone-400 ml-auto">{total} user</span>
        </div>

        {loading && <div className="text-xs text-stone-400 py-8 text-center">Loading...</div>}
        {!loading && users.length === 0 && <div className="text-xs text-stone-400 py-8 text-center">Tidak ada user</div>}

        {!loading && users.map(u => (
          <div key={u.id} onClick={() => openDrawer(u.id)} className="flex items-center gap-3 py-2.5 px-3 border-b border-stone-50 hover:bg-stone-50 cursor-pointer rounded-lg text-xs">
            <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center font-bold shrink-0">{u.name?.[0] ?? u.email[0].toUpperCase()}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-stone-800 truncate">{u.name ?? '—'}</div>
              <div className="text-stone-400 truncate">{u.email}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">{statusBadge(u.status)}</div>
            <span className="text-stone-600 font-mono shrink-0">{fmtRp(u.creditBalance)}</span>
            <span className="text-stone-400 shrink-0">{u._count.campaignSessions} camp</span>
            <span className="text-stone-400 shrink-0">{timeAgo(u.lastLoginAt)}</span>
            {u.status === 'pending' && <button onClick={e => { e.stopPropagation(); doAction(u.id, { status: 'active' }) }} className="text-xs text-violet-600 font-medium shrink-0 hover:underline">Approve</button>}
          </div>
        ))}

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 text-xs border border-stone-200 rounded-lg disabled:opacity-30">←</button>
            <span className="px-3 py-1 text-xs text-stone-500">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 text-xs border border-stone-200 rounded-lg disabled:opacity-30">→</button>
          </div>
        )}
      </div>

      {/* Drawer */}
      {selectedUserId && (
        <div className="w-full lg:w-96 border-l border-stone-200 bg-white overflow-y-auto p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-stone-900">Detail User</h3>
            <button onClick={() => setSelectedUserId(null)} className="text-stone-400 hover:text-stone-600 text-lg">×</button>
          </div>

          {detailLoading && <div className="text-xs text-stone-400 py-4">Loading...</div>}

          {detail && (
            <div className="space-y-4 text-xs">
              {/* Profile */}
              <div className="bg-stone-50 rounded-lg p-3">
                <div className="font-bold text-stone-900">{detail.user.name ?? '—'}</div>
                <div className="text-stone-500">{detail.user.email}</div>
                <div className="flex items-center gap-2 mt-1">{statusBadge(detail.user.status)}<span className="text-stone-400">{detail.user.role}</span></div>
                <div className="text-stone-400 mt-1">Daftar {new Date(detail.user.createdAt).toLocaleDateString('id-ID')} · Aktif {timeAgo(detail.user.lastLoginAt)}</div>
              </div>

              {/* Credits */}
              <div className="bg-stone-50 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-stone-900">💰 Saldo: {fmtRp(detail.credits.balance)}</span>
                  <button onClick={() => grantCredits(detail.user.id)} className="text-xs text-violet-600 hover:underline font-medium">+ Grant</button>
                </div>
                <div className="text-stone-500">Di-grant {fmtRp(detail.credits.granted)} · Kepakai {fmtRp(detail.credits.consumed)}</div>
                {detail.credits.transactions.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-stone-400 cursor-pointer">Riwayat transaksi</summary>
                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                      {detail.credits.transactions.map(t => (
                        <div key={t.id} className="flex justify-between py-0.5 border-b border-stone-100 last:border-0">
                          <span className="text-stone-500">{t.reason}</span>
                          <span className={'font-mono ' + (t.amount > 0 ? 'text-emerald-600' : 'text-red-600')}>{t.amount > 0 ? '+' : ''}{t.amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>

              {/* Usage */}
              <div className="bg-stone-50 rounded-lg p-3">
                <h4 className="font-bold text-stone-900 mb-2">📊 Pemakaian</h4>
                <div className="space-y-1.5 text-stone-600">
                  <div className="flex justify-between"><span>🎬 Video</span><span>{detail.usage.videos.total} ({detail.usage.videos.completed} ok, {detail.usage.videos.failed} gagal)</span></div>
                  <div className="flex justify-between"><span>🚀 Campaign</span><span>{detail.usage.campaigns.total} ({detail.usage.campaigns.running} jalan)</span></div>
                  <div className="flex justify-between"><span>🔑 API key</span><span>{detail.usage.apiKeys.filter(k => k.status === 'active').length} aktif</span></div>
                  <div className="flex justify-between"><span>🔗 Akun Meta</span><span>{detail.usage.metaAccounts}</span></div>
                  <div className="flex justify-between"><span>📊 Spend Meta</span><span>{fmtRp(detail.usage.spendAllTime)}</span></div>
                </div>
                {detail.usage.apiKeys.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {detail.usage.apiKeys.map(k => (
                      <div key={k.id} className="flex justify-between items-center py-0.5 text-xs">
                        <span><code className="bg-stone-200 px-1 rounded">{k.prefix}***</code> · {k.status} · {timeAgo(k.lastUsedAt)}</span>
                        {k.status === 'active' && <button onClick={() => revokeKey(detail.user.id, k.id)} className="text-red-500 hover:underline">Revoke</button>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="bg-stone-50 rounded-lg p-3 space-y-2">
                <h4 className="font-bold text-stone-900">Aksi</h4>
                <div className="flex flex-wrap gap-2">
                  {detail.user.status === 'active' && <button onClick={() => doAction(detail.user.id, { status: 'suspended' })} className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200" disabled={detail.user.id === selectedUserId as string}>Suspend</button>}
                  {detail.user.status === 'suspended' && <button onClick={() => doAction(detail.user.id, { status: 'active' })} className="px-3 py-1.5 text-xs bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200">Aktifkan</button>}
                  {detail.user.role === 'user' && <button onClick={() => doAction(detail.user.id, { role: 'admin' })} className="px-3 py-1.5 text-xs bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200">Jadikan admin</button>}
                  {detail.user.role === 'admin' && <button onClick={() => doAction(detail.user.id, { role: 'user' })} className="px-3 py-1.5 text-xs bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200">Turunkan role</button>}
                </div>
                {detail.user.id === selectedUserId as string && detail.user.role === 'admin' && detail.user.status === 'active' && <div className="text-xs text-amber-600">⚠️ Ini admin aktif — tombol suspend/demote disabled untuk akun sendiri</div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>

      <ConfirmDialog
        open={confirmRevoke !== null}
        title="Revoke API Key"
        body={<p>Revoke API key ini? Akses dengan key ini akan langsung terputus.</p>}
        confirmLabel="Revoke"
        danger
        onConfirm={revokeKeyConfirm}
        onCancel={() => setConfirmRevoke(null)}
      />
  )
}
