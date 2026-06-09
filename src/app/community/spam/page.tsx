'use client'

import { useEffect, useState } from 'react'
import PageInfo from '@/components/ui/PageInfo'
import Table from '@/components/ui/Table'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'

interface MetaComment {
  id: string
  metaCommentId: string
  message: string | null
  authorName: string | null
  authorMetaId: string | null
  sentiment: string | null
  moderationState: string
  commentedAt: string | null
  metaPage: { pageName: string; pageId: string } | null
  metaAccount: { id: string; name: string } | null
}

interface CommentsResponse {
  comments: MetaComment[]
  total: number
  page: number
  pages: number
  stats: { pending: number; replied: number; deleted: number }
}

export default function SpamPage() {
  const [data, setData] = useState<CommentsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('')
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; commentId: string | null }>({ open: false, commentId: null })
  const [unmarkModal, setUnmarkModal] = useState<{ open: boolean; comment: MetaComment | null }>({ open: false, comment: null })
  const [actionLoading, setActionLoading] = useState(false)
  const [fetching, setFetching] = useState(false)

  const fetchComments = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/community/comments?state=deleted&limit=100')
      if (!res.ok) throw new Error('Failed to fetch comments')
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleSyncFromMeta = async () => {
    setFetching(true)
    try {
      const res = await fetch('/api/admin/community/comments', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Sync failed')
      }
      fetchComments()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setFetching(false)
    }
  }

  const handleUnmark = async () => {
    const comment = unmarkModal.comment
    if (!comment) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/community/comments/${comment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moderationState: 'pending' }),
      })
      if (!res.ok) throw new Error('Failed to unmark')
      setUnmarkModal({ open: false, comment: null })
      fetchComments()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unmark failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteModal.commentId) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/community/comments/${deleteModal.commentId}/delete`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to delete')
      setDeleteModal({ open: false, commentId: null })
      fetchComments()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setActionLoading(false)
    }
  }

  const filteredComments = data?.comments.filter(c => {
    if (!filter) return true
    const q = filter.toLowerCase()
    return (
      c.message?.toLowerCase().includes(q) ||
      c.authorName?.toLowerCase().includes(q) ||
      c.metaPage?.pageName.toLowerCase().includes(q)
    )
  }) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Spam Comments</h1>
          <p className="section-sub">Auto-deleted or hidden spam comments from your Meta pages.</p>
        </div>
        <button
          onClick={handleSyncFromMeta}
          className="btn-secondary"
          disabled={fetching}
        >
          {fetching ? 'Syncing...' : '🔄 Sync from Meta'}
        </button>
      </div>

      <PageInfo
        purpose="Review and manage spam comments that were auto-deleted or hidden. You can restore mistakenly flagged comments or permanently delete them."
        inputs={['Comment text', 'Author', 'Platform', 'Date', 'Original moderation action']}
      />

      {data && (
        <div className="flex gap-4 text-sm">
          <span className="badge-pending">Pending Review: {data.stats.pending}</span>
          <span className="badge-active">Replied: {data.stats.replied}</span>
          <span className="badge-error">Deleted: {data.stats.deleted}</span>
        </div>
      )}

      <div className="card">
        <div className="px-4 py-3 border-b border-stone-200 flex gap-3 items-center">
          <input
            type="text"
            placeholder="Filter comments..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="input-field text-sm flex-1"
          />
          <button onClick={fetchComments} className="btn-secondary text-sm" disabled={loading}>
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
            headers={['Comment', 'Author', 'Platform', 'Date', 'Sentiment', 'Actions']}
            empty="No spam comments found."
          >
            {filteredComments.map(c => (
              <tr key={c.id}>
                <td className="px-4 py-3 max-w-[300px]">
                  <span className="text-sm truncate block">{c.message || '—'}</span>
                </td>
                <td className="px-4 py-3 text-stone-600 text-sm">{c.authorName ?? 'Unknown'}</td>
                <td className="px-4 py-3 text-stone-600">{c.metaPage?.pageName ?? '—'}</td>
                <td className="px-4 py-3 text-stone-500 text-sm">
                  {c.commentedAt
                    ? new Date(c.commentedAt).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={c.sentiment ?? 'neutral'} />
                </td>
                <td className="px-4 py-3 flex gap-2">
                  <button
                    onClick={() => setUnmarkModal({ open: true, comment: c })}
                    className="text-green-600 hover:text-green-800 text-sm font-medium"
                  >
                    Unmark
                  </button>
                  <button
                    onClick={() => setDeleteModal({ open: true, commentId: c.id })}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Delete Permanently
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      <Modal
        open={unmarkModal.open}
        onClose={() => setUnmarkModal({ open: false, comment: null })}
        title="Unmark as Spam"
      >
        <p className="text-stone-600 mb-4">
          Restore this comment from spam and mark it for manual review?
        </p>
        <div className="bg-stone-50 p-3 rounded text-sm text-stone-600 mb-4">
          <strong>"{unmarkModal.comment?.message}"</strong>
          <br />
          <span className="text-stone-400">— {unmarkModal.comment?.authorName ?? 'Unknown'}</span>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setUnmarkModal({ open: false, comment: null })}
            className="btn-secondary"
            disabled={actionLoading}
          >
            Cancel
          </button>
          <button onClick={handleUnmark} className="btn-primary" disabled={actionLoading}>
            {actionLoading ? 'Restoring...' : 'Unmark Spam'}
          </button>
        </div>
      </Modal>

      <Modal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, commentId: null })}
        title="Delete Permanently"
      >
        <p className="text-stone-600 mb-4">
          Permanently delete this comment? This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setDeleteModal({ open: false, commentId: null })}
            className="btn-secondary"
            disabled={actionLoading}
          >
            Cancel
          </button>
          <button onClick={handleDelete} className="btn-error" disabled={actionLoading}>
            {actionLoading ? 'Deleting...' : 'Delete Permanently'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
