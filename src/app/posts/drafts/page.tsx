'use client'

import { useEffect, useState } from 'react'
import PageInfo from '@/components/ui/PageInfo'
import Table from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'

interface MetaPost {
  id: string
  title: string | null
  message: string | null
  status: string
  postType: string | null
  mediaUrlsJson: string | null
  linkUrl: string | null
  createdAt: string
  metaPage: { id: string; pageId: string; pageName: string } | null
}

interface PostsResponse {
  posts: MetaPost[]
  total: number
  stats: { draft: number; published: number; scheduled: number; failed: number }
  pagination: { page: number; limit: number; total: number }
}

export default function DraftsPage() {
  const [data, setData] = useState<PostsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; postId: string | null }>({ open: false, postId: null })
  const [publishModal, setPublishModal] = useState<{ open: boolean; post: MetaPost | null }>({ open: false, post: null })
  const [actionLoading, setActionLoading] = useState(false)

  const fetchDrafts = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/posts?status=draft&limit=100')
      if (!res.ok) throw new Error('Failed to fetch drafts')
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDrafts()
  }, [])

  const handlePublish = async () => {
    const post = publishModal.post
    if (!post) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/posts/${post.id}/publish`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Publish failed')
      }
      setPublishModal({ open: false, post: null })
      fetchDrafts()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Publish failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteModal.postId) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/admin/posts/${deleteModal.postId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setDeleteModal({ open: false, postId: null })
      fetchDrafts()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Drafts</h1>
          <p className="section-sub">Saved post drafts waiting to be scheduled or published.</p>
        </div>
        <a href="/posts/new" className="btn-primary">
          + New Post
        </a>
      </div>

      <PageInfo
        purpose="Draft posts before publishing. Save work-in-progress content and return to edit later."
        inputs={['Content text', 'Attached media', 'Post type (image/video/text)']}
      />

      <div className="card">
        <div className="px-4 py-3 border-b border-stone-200 flex justify-end">
          <button onClick={fetchDrafts} className="btn-secondary text-sm" disabled={loading}>
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
            headers={['Title', 'Platform', 'Created', 'Preview', 'Actions']}
            empty="No drafts found."
          >
            {data?.posts.map(d => (
              <tr key={d.id}>
                <td className="px-4 py-3">
                  <a href={`/posts/drafts/${d.id}`} className="text-violet-700 hover:underline font-medium">
                    {d.title || <span className="text-stone-400 italic">Untitled</span>}
                  </a>
                </td>
                <td className="px-4 py-3 text-stone-600">{d.metaPage?.pageName ?? '—'}</td>
                <td className="px-4 py-3 text-stone-500 text-sm">
                  {new Date(d.createdAt).toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="px-4 py-3">
                  <span className="text-stone-500 text-sm truncate max-w-xs block">
                    {d.message ? d.message.substring(0, 60) + (d.message.length > 60 ? '...' : '') : '—'}
                  </span>
                </td>
                <td className="px-4 py-3 flex gap-3">
                  <button
                    onClick={() => setPublishModal({ open: true, post: d })}
                    className="text-green-600 hover:text-green-800 text-sm font-medium"
                  >
                    Publish
                  </button>
                  <a href={`/posts/drafts/${d.id}`} className="text-violet-600 hover:text-violet-800 text-sm">
                    Edit
                  </a>
                  <button
                    onClick={() => setDeleteModal({ open: true, postId: d.id })}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      <Modal
        open={publishModal.open}
        onClose={() => setPublishModal({ open: false, post: null })}
        title="Publish Draft"
      >
        <p className="text-stone-600 mb-4">
          Publish <strong>{publishModal.post?.title || 'this post'}</strong> to{' '}
          <strong>{publishModal.post?.metaPage?.pageName ?? 'its page'}</strong>?
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setPublishModal({ open: false, post: null })}
            className="btn-secondary"
            disabled={actionLoading}
          >
            Cancel
          </button>
          <button onClick={handlePublish} className="btn-primary" disabled={actionLoading}>
            {actionLoading ? 'Publishing...' : 'Publish Now'}
          </button>
        </div>
      </Modal>

      <Modal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, postId: null })}
        title="Delete Draft"
      >
        <p className="text-stone-600 mb-4">Are you sure you want to delete this draft? This action cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setDeleteModal({ open: false, postId: null })}
            className="btn-secondary"
            disabled={actionLoading}
          >
            Cancel
          </button>
          <button onClick={handleDelete} className="btn-error" disabled={actionLoading}>
            {actionLoading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
