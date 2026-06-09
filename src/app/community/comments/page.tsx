import PageInfo from '@/components/ui/PageInfo'
import Table from '@/components/ui/Table'

const comments = [
  { id: '1', post: 'Taracare Body Lotion Promo', author: 'Mbak Dina', text: 'Harga berapa ya?', sentiment: 'neutral', status: 'pending', time: '2h ago' },
  { id: '2', post: 'Glazingskin UV Defense', author: 'Kak Rina', text: 'Wangi banget ini!', sentiment: 'positive', status: 'replied', time: '3h ago' },
  { id: '3', post: 'Taracare Body Lotion Promo', author: 'unknown_user_x', text: 'http://spam-link.com', sentiment: 'spam', status: 'deleted', time: '4h ago' },
  { id: '4', post: 'TaraCare Calming Cream Review', author: 'Mbak Sari', text: 'Kirim ke jakarta bisa?', sentiment: 'neutral', status: 'pending', time: '5h ago' },
]

export default function CommentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Comments</h1>
          <p className="section-sub">Monitor and manage comments across all connected Pages and posts.</p>
        </div>
        <a href="/community/comments/review" className="btn-primary">
          Review Pending
        </a>
      </div>

      <PageInfo
        purpose="Central inbox for all comments on Facebook Pages and Instagram Business posts. Review, reply, auto-handle via rules."
        inputs={['Page filter', 'Post filter', 'Status (pending/replied/spam)', 'Sentiment']}
      />

      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-stone-900 dark:text-stone-50">12</p>
          <p className="text-xs text-stone-500">Pending</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">48</p>
          <p className="text-xs text-stone-500">Replied</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-red-700 dark:text-red-400">7</p>
          <p className="text-xs text-stone-500">Spam Deleted</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">23</p>
          <p className="text-xs text-stone-500">Auto-Replied</p>
        </div>
      </div>

      <div className="card">
        <Table
          headers={['Post', 'Author', 'Comment', 'Sentiment', 'Status', 'Time']}
        >
          {comments.map(c => (
            <tr key={c.id}>
              <td className="px-4 py-3"><span className="text-xs text-stone-500 max-w-[120px] truncate block">{c.post}</span></td>
              <td className="px-4 py-3">{c.author}</td>
              <td className="px-4 py-3"><span className="text-sm max-w-[200px] truncate block">{c.text}</span></td>
              <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded ${
                c.sentiment === 'positive' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' :
                c.sentiment === 'spam' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                'bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300'
              }`}>{c.sentiment}</span></td>
              <td className="px-4 py-3"><span className={`badge-${
                c.status === 'replied' ? 'active' :
                c.status === 'deleted' ? 'inactive' : 'pending'
              }`}>{c.status}</span></td>
              <td className="px-4 py-3">{c.time}</td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  )
}
