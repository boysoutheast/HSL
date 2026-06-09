'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageInfo from '@/components/ui/PageInfo'
import Table from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'

interface MetaChatThread {
  id: string
  threadMetaId: string
  customerName: string | null
  customerMetaId: string | null
  platform: string
  unreadCount: number
  lastMessageAt: string | null
  lastSyncedAt: string | null
  metaPage: { pageName: string; pageId: string } | null
  metaAccount: { id: string; name: string } | null
  _count: { messages: number }
}

interface ChatResponse {
  threads: MetaChatThread[]
  total: number
  page: number
  pages: number
}

export default function ChatPage() {
  const router = useRouter()
  const [data, setData] = useState<ChatResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('')
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncResult, setSyncResult] = useState<{ open: boolean; results: Array<{ pageName: string; threadsFetched: number; messagesFetched: number; errors: string[] }> | null }>({ open: false, results: null })

  const fetchThreads = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/chat?limit=100')
      if (!res.ok) throw new Error('Failed to fetch conversations')
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchThreads()
  }, [])

  const handleSync = async () => {
    setSyncLoading(true)
    setSyncResult({ open: false, results: null })
    try {
      const res = await fetch('/api/admin/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Sync failed')
      }
      const result = await res.json()
      setSyncResult({ open: true, results: result.results })
      fetchThreads()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncLoading(false)
    }
  }

  const filteredThreads = data?.threads.filter(t => {
    if (!filter) return true
    const q = filter.toLowerCase()
    return (
      t.customerName?.toLowerCase().includes(q) ||
      t.metaPage?.pageName.toLowerCase().includes(q) ||
      t.platform.toLowerCase().includes(q)
    )
  }) ?? []

  const totalUnread = data?.threads.reduce((sum, t) => sum + t.unreadCount, 0) ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Chat Conversations</h1>
          <p className="section-sub">Manage Meta messaging conversations with your customers.</p>
        </div>
        <button onClick={handleSync} className="btn-primary" disabled={syncLoading}>
          {syncLoading ? 'Syncing...' : '🔄 Sync from Meta'}
        </button>
      </div>

      <PageInfo
        purpose="View and manage customer conversations from Facebook Messenger and Instagram DM. Sync latest messages from Meta and reply directly."
        inputs={['Customer name', 'Platform', 'Last message preview', 'Unread count', 'Last message time']}
      />

      {data && (
        <div className="flex gap-4 text-sm">
          <span className="badge-active">Total: {data.total}</span>
          {totalUnread > 0 && (
            <span className="badge-pending">Unread: {totalUnread}</span>
          )}
        </div>
      )}

      <div className="card">
        <div className="px-4 py-3 border-b border-stone-200 flex gap-3 items-center">
          <input
            type="text"
            placeholder="Filter conversations..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="input-field text-sm flex-1"
          />
          <button onClick={fetchThreads} className="btn-secondary text-sm" disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-6 w-6 border-2 border-violet-600 border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="px-4 py-8 text-center text-red-600">{error}</div>
        ) : (
          <Table
            headers={['Customer', 'Platform', 'Last Message', 'Unread', 'Last Message At', '']}
            empty="No conversations found."
          >
            {filteredThreads.map(t => (
              <tr
                key={t.id}
                className="hover:bg-stone-50 cursor-pointer"
                onClick={() => router.push(`/community/chat/${t.id}`)}
              >
                <td className="px-4 py-3">
                  <span className="font-medium">{t.customerName ?? 'Unknown Customer'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="capitalize text-stone-600">{t.platform}</span>
                </td>
                <td className="px-4 py-3 text-stone-500 text-sm">
                  <span className="truncate max-w-[200px] block">
                    via {t.metaPage?.pageName ?? 'Unknown Page'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {t.unreadCount > 0 ? (
                    <span className="badge-pending">{t.unreadCount} unread</span>
                  ) : (
                    <span className="text-stone-400 text-sm">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-stone-500 text-sm">
                  {t.lastMessageAt
                    ? new Date(t.lastMessageAt).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                </td>
                <td className="px-4 py-3 text-violet-600 text-sm">
                  View →
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      <Modal
        open={syncResult.open}
        onClose={() => setSyncResult({ open: false, results: null })}
        title="Sync Complete"
      >
        {syncResult.results && syncResult.results.length > 0 ? (
          <div className="space-y-3">
            {syncResult.results.map((r, i) => (
              <div key={i} className="p-3 bg-stone-50 rounded text-sm">
                <strong>{r.pageName}</strong>: {r.threadsFetched} threads, {r.messagesFetched} messages synced
                {r.errors.length > 0 && (
                  <p className="text-red-500 mt-1">Errors: {r.errors.join(', ')}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-stone-600">No new data synced.</p>
        )}
        <div className="flex justify-end mt-4">
          <button onClick={() => setSyncResult({ open: false, results: null })} className="btn-primary">
            OK
          </button>
        </div>
      </Modal>
    </div>
  )
}
