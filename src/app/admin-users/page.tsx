'use client'

import { useEffect, useState, useCallback } from 'react'
import StatusBadge from '@/components/ui/StatusBadge'
import Table from '@/components/ui/Table'
import PageInfo from '@/components/ui/PageInfo'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'

interface AdminUser {
  id: string
  email: string
  name: string | null
  role: string
  status: string
  createdAt: string
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  // Search/filter
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState<{ id: string; status: 'active' | 'rejected'; name: string } | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set('q', searchQuery)
      if (statusFilter) params.set('status', statusFilter)
      if (roleFilter) params.set('role', roleFilter)

      const res = await fetch(`/api/admin/admin-users?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'include',
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setUsers(data.users ?? [])
    } catch {
      setError('Gagal memuat data users.')
    } finally {
      setLoading(false)
    }
  }, [searchQuery, statusFilter, roleFilter])

  useEffect(() => {
    // Fetch current user identity
    fetch('/api/admin/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.user) setCurrentUserId(d.user.id) })
      .catch(() => {})

    fetchUsers()
  }, [fetchUsers])

  const handleAction = (id: string, status: 'active' | 'rejected', name: string) => setPendingAction({ id, status, name })
  const doAction = async (id: string, status: 'active' | 'rejected') => {
    setActionLoading(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/admin-users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Error ${res.status}`)
      }
      await fetchUsers()
    } catch (err) {
      setError(String(err).replace('Error: ', ''))
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    setDeleteLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/admin-users/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Error ${res.status}`)
      }
      setDeleteTarget(null)
      await fetchUsers()
    } catch (err) {
      setError(String(err).replace('Error: ', ''))
    } finally {
      setDeleteLoading(false)
    }
  }

  const pendingUsers = users.filter((u) => u.status === 'pending')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Admin Users</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          {loading
            ? '...'
            : `${users.length} total · ${pendingUsers.length} pending approval`}
        </p>
      </div>

      <PageInfo
        purpose="Kelola user yang punya akses ke dashboard AI Buddy. User baru harus di-approve dulu sebelum bisa login."
        inputs={[
          'User terdaftar otomatis via halaman Register',
          'Status: pending → perlu approve atau reject',
          'Status: active → bisa login dan pakai dashboard',
          'Status: rejected → tidak bisa login',
          'Delete: soft-delete — tidak bisa di-recover tanpa admin DB',
        ]}
        wiring={[
          { label: '→ API Register', desc: 'user baru selalu status = pending' },
          { label: '→ Login', desc: 'hanya user status = active yang bisa login' },
        ]}
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* Search / Filter */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama atau email..."
          className="px-3.5 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 w-full max-w-xs"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Semua Status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
          <option value="deleted">Deleted</option>
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Semua Role</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-stone-400 text-sm">
          Loading users...
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          icon="👤"
          title="Tidak ada user ditemukan"
          description={searchQuery || statusFilter || roleFilter ? 'Coba ubah filter atau kata kunci pencarian' : 'Belum ada user terdaftar.'}
        />
      ) : (
        <Table
          headers={['Name', 'Email', 'Role', 'Status', 'Registered', 'Actions']}
          empty="No users found."
        >
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-stone-50 transition-colors">
              <td className="px-4 py-3">
                <span className="font-medium text-stone-900">
                  {user.name ?? '—'}
                </span>
              </td>
              <td className="px-4 py-3 text-stone-600">{user.email}</td>
              <td className="px-4 py-3">
                <span
                  className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    user.role === 'admin'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {user.role === 'admin' ? '👑 Admin' : 'User'}
                </span>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={user.status} />
              </td>
              <td className="px-4 py-3 text-stone-500 text-xs whitespace-nowrap">
                {formatDate(user.createdAt)}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {user.status === 'pending' ? (
                    <>
                      <button
                        onClick={() =>
                          handleAction(user.id, 'active', user.name ?? user.email)
                        }
                        disabled={actionLoading === user.id}
                        className="btn-success btn-sm"
                      >
                        {actionLoading === user.id ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() =>
                          handleAction(user.id, 'rejected', user.name ?? user.email)
                        }
                        disabled={actionLoading === user.id}
                        className="btn-danger btn-sm"
                      >
                        {actionLoading === user.id ? '...' : 'Reject'}
                      </button>
                    </>
                  ) : user.status === 'active' ? (
                    <button
                      onClick={() =>
                        handleAction(user.id, 'rejected', user.name ?? user.email)
                      }
                      disabled={actionLoading === user.id}
                      className="btn-danger btn-sm"
                    >
                      {actionLoading === user.id ? '...' : 'Deactivate'}
                    </button>
                  ) : (
                    <span className="text-xs text-stone-400 italic">
                      {user.status === 'deleted' ? 'Deleted' : 'Inactive'}
                    </span>
                  )}

                  {/* Delete button — hidden for self */}
                  {user.id !== currentUserId && user.status !== 'deleted' && (
                    <button
                      onClick={() => setDeleteTarget(user)}
                      className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors"
                      title="Hapus user"
                    >
                      🗑
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus User"
        body={
          <p>
            Yakin ingin menghapus <strong>{deleteTarget?.name ?? deleteTarget?.email}</strong>?
            <br />
            <span className="text-yellow-700 text-xs">
              User akan di-soft-delete (status=&quot;deleted&quot;) dan session-nya dicabut.
            </span>
          </p>
        }
        confirmLabel="Hapus User"
        danger
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction?.status === 'active' ? 'Approve User' : 'Reject User'}
        body={<p>{pendingAction?.status === 'active' ? 'Approve' : 'Reject'} user <strong>{pendingAction?.name}</strong>?</p>}
        confirmLabel={pendingAction?.status === 'active' ? 'Approve' : 'Reject'}
        danger={pendingAction?.status === 'rejected'}
        onConfirm={() => { const a = pendingAction; setPendingAction(null); if (a) doAction(a.id, a.status) }}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  )
}
