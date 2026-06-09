'use client'

import { useEffect, useState } from 'react'
import PageInfo from '@/components/ui/PageInfo'
import Table from '@/components/ui/Table'
import StatusBadge from '@/components/ui/StatusBadge'

interface MetaPost {
  id: string
  title: string | null
  message: string | null
  status: string
  postType: string | null
  publishedAt: string | null
  createdAt: string
  metaPage: { id: string; pageId: string; pageName: string } | null
  _count: { stats: number }
}

interface ContentResponse {
  content: MetaPost[]
  total: number
  pages: number
  stats: { draft: number; published: number; scheduled: number; failed: number }
  pagination: { page: number; limit: number; total: number }
}

export default function StatsPage() {
  const [data, setData] = useState<ContentResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('')
  const [refreshing, setRefreshing] = useState(false)

  const fetchContent = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/content?limit=100')
      if (!res.ok) throw new Error('Failed to fetch content')
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchContent()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchContent()
    setRefreshing(false)
  }

  const filteredContent = data?.content.filter(p => {
    if (!filter) return true
    const q = filter.toLowerCase()
    return (
      p.title?.toLowerCase().includes(q) ||
      p.message?.toLowerCase().includes(q) ||
      p.metaPage?.pageName.toLowerCase().includes(q)
    )
  }) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Content Stats</h1>
          <p className="section-sub">Overview of published content performance and statistics.</p>
        </div>
        <button
          onClick={handleRefresh}
          className="btn-secondary"
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing...' : '🔄 Refresh Stats'}
        </button>
      </div>

      <PageInfo
        purpose="View statistics and performance metrics for published posts. See which content is performing well across your Meta pages."
        inputs={['Post title and preview', 'Platform/Page', 'Published date', 'Engagement stats (likes, comments, shares)']}
        wiring={[
          { label: 'Meta Insights', desc: 'Likes, comments, shares, and reach data from Meta Graph API' },
          { label: 'Post Type', desc: 'Feed, story, reel, or video post performance breakdown' },
        ]}
      />

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4 text-center">
            <p className="text-3xl font-bold text-violet-600">{data.stats.published}</p>
            <p className="text-sm text-stone-500 mt-1">Published</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-3xl font-bold text-orange-500">{data.stats.scheduled}</p>
            <p className="text-sm text-stone-500 mt-1">Scheduled</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-3xl font-bold text-stone-400">{data.stats.draft}</p>
            <p className="text-sm text-stone-500 mt-1">Drafts</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-3xl font-bold text-red-500">{data.stats.failed}</p>
            <p className="text-sm text-stone-500 mt-1">Failed</p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="px-4 py-3 border-b border-stone-200 flex gap-3 items-center">
          <input
            type="text"
            placeholder="Filter content..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="input-field text-sm flex-1"
          />
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-6 w-6 border-2 border-violet-600 border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="px-4 py-8 text-center text-red-600">{error}</div>
        ) : (
          <Table
            headers={['Title', 'Platform', 'Status', 'Published', 'Stats Records']}
            empty="No published content found."
          >
            {filteredContent.map(p => (
              <tr key={p.id}>
                <td className="px-4 py-3">
                  <a href={`/posts/${p.id}`} className="text-violet-700 hover:underline font-medium">
                    {p.title || <span className="text-stone-400 italic">Untitled</span>}
                  </a>
                  {p.message && (
                    <p className="text-xs text-stone-500 truncate max-w-[300px] mt-0.5">
                      {p.message.substring(0, 80)}...
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-stone-600">{p.metaPage?.pageName ?? '—'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-4 py-3 text-stone-500 text-sm">
                  {p.publishedAt
                    ? new Date(p.publishedAt).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <a
                    href={`/posts/${p.id}#stats`}
                    className="text-violet-600 hover:text-violet-800 text-sm"
                  >
                    {p._count.stats} records
                  </a>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </div>
  )
}
