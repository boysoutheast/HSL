import PageInfo from '@/components/ui/PageInfo'
import Table from '@/components/ui/Table'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function formatAgo(date: Date | null) {
  if (!date) return '—'
  const diffMs = Date.now() - date.getTime()
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  if (hours < 1) {
    const mins = Math.floor(diffMs / (1000 * 60))
    return `${Math.max(mins, 1)}m ago`
  }
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function sentimentClass(sentiment: string) {
  if (sentiment === 'positive') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
  if (sentiment === 'spam') return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
  return 'bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300'
}

function statusBadge(status: string) {
  if (status === 'replied') return 'badge-active'
  if (status === 'deleted') return 'badge-inactive'
  return 'badge-pending'
}

export default async function CommentsPage() {
  const [comments, pendingCount, repliedCount, deletedCount] = await Promise.all([
    prisma.metaComment.findMany({
      orderBy: { commentedAt: 'desc' },
      take: 50,
      include: {
        metaPage: { select: { pageName: true, pageId: true } },
      },
    }),
    prisma.metaComment.count({ where: { moderationState: 'pending' } }),
    prisma.metaComment.count({ where: { moderationState: 'replied' } }),
    prisma.metaComment.count({ where: { moderationState: 'deleted' } }),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="section-title">Comments</h1>
          <p className="section-sub">Monitor and manage comments across all connected Meta Pages.</p>
        </div>
        <div className="flex items-center gap-2">
          <form action="/api/admin/community/comments" method="post">
            <button type="submit" className="btn-secondary">Fetch Latest</button>
          </form>
          <a href="/community/comments/review" className="btn-primary">Review Pending</a>
        </div>
      </div>

      <PageInfo
        purpose="Central inbox for Facebook Page and Instagram Business comments fetched via Meta Graph API."
        inputs={['Meta Connection with synced Pages', 'Page access token or account token', 'Recent post comments fetch']}
        wiring={[
          { label: 'Fetch source', desc: 'GET Page feed → GET post comments via Meta Graph API v21' },
          { label: 'Storage', desc: 'Comments cached in PostgreSQL table meta_comments for moderation workflow' },
          { label: 'Next phase', desc: 'Reply actions and auto-reply rules will update moderation state' },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-stone-900 dark:text-stone-50">{pendingCount}</p>
          <p className="text-xs text-stone-500">Pending</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{repliedCount}</p>
          <p className="text-xs text-stone-500">Replied</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-red-700 dark:text-red-400">{deletedCount}</p>
          <p className="text-xs text-stone-500">Deleted</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{comments.length}</p>
          <p className="text-xs text-stone-500">Loaded</p>
        </div>
      </div>

      <div className="card">
        <Table headers={['Page / Post', 'Author', 'Comment', 'Sentiment', 'Status', 'Time']} empty="No comments fetched yet. Click Fetch Latest after syncing Meta pages.">
          {comments.map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-3">
                <span className="text-xs text-stone-500 max-w-[140px] truncate block">{c.metaPage?.pageName ?? c.metaPage?.pageId ?? c.metaPostId ?? 'Unknown Page'}</span>
              </td>
              <td className="px-4 py-3">{c.authorName ?? 'Unknown'}</td>
              <td className="px-4 py-3"><span className="text-sm max-w-[260px] truncate block">{c.message}</span></td>
              <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded ${sentimentClass(c.sentiment)}`}>{c.sentiment}</span></td>
              <td className="px-4 py-3"><span className={statusBadge(c.moderationState)}>{c.moderationState}</span></td>
              <td className="px-4 py-3">{formatAgo(c.commentedAt)}</td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  )
}
