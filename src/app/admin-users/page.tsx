'use client'

import { useEffect, useState, useCallback } from 'react'
import StatusBadge from '@/components/ui/StatusBadge'
import Table from '@/components/ui/Table'
import PageInfo from '@/components/ui/PageInfo'

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

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/admin-users', {
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
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleAction = async (id: string, status: 'active' | 'rejected', name: string) => {
    const label = status === 'active' ? 'Approve' : 'Reject'
    if (!confirm(`${label} user ${name}?`)) return

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

  const pendingUsers = users.filter((u) => u.status === 'pending')
  const activeUsers = users.filter((u) => u.status === 'active')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Users</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {loading
            ? '...'
            : `${users.length} total · ${pendingUsers.length} pending approval`}
        </p>
      </div>

      <PageInfo
        purpose="Kelola user yang punya akses ke dashboard Hermes. User baru harus di-approve dulu sebelum bisa login."
        inputs={[
          'User terdaftar otomatis via halaman Register',
          'Status: pending → perlu approve atau reject',
          'Status: active → bisa login dan pakai dashboard',
          'Status: rejected → tidak bisa login',
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

      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
          Loading users...
        </div>
      ) : (
        <Table
          headers={['Name', 'Email', 'Role', 'Status', 'Registered', 'Actions']}
          empty="No users found."
        >
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <span className="font-medium text-gray-900">
                  {user.name ?? '—'}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-600">{user.email}</td>
              <td className="px-4 py-3">
                <span
                  className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    user.role === 'admin'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {user.role === 'admin' ? '👑 Admin' : 'User'}
                </span>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={user.status} />
              </td>
              <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
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
                    <span className="text-xs text-gray-400 italic">Inactive</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
