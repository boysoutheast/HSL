import PageInfo from '@/components/ui/PageInfo'
import Table from '@/components/ui/Table'

const posts = [
  { id: '1', title: 'Taracare Body Lotion Promo', platform: 'Facebook', status: 'published', scheduledAt: '2026-06-09 10:00', reach: '2,340' },
  { id: '2', title: 'Glazingskin UV Defense', platform: 'Instagram', status: 'scheduled', scheduledAt: '2026-06-12 08:00', reach: '—' },
  { id: '3', title: 'TaraCare Calming Cream Review', platform: 'Facebook', status: 'draft', scheduledAt: '—', reach: '—' },
]

export default function PostsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Posts</h1>
          <p className="section-sub">Manage scheduled and published content across Meta platforms.</p>
        </div>
        <a href="/posts/new" className="btn-primary">
          + New Post
        </a>
      </div>

      <PageInfo
        purpose="Create and manage posts across Facebook Pages and Instagram Business accounts."
        inputs={['Content text', 'Media (image/video)', 'Schedule date & time', 'Target Page']}
      />

      <div className="card">
        <Table
          headers={['Title', 'Platform', 'Status', 'Scheduled', 'Reach']}
        >
          {posts.map(p => (
            <tr key={p.id}>
              <td className="px-4 py-3">{p.title}</td>
              <td className="px-4 py-3">{p.platform}</td>
              <td className="px-4 py-3">
                <span className={`badge-${
                  p.status === 'published' ? 'active' :
                  p.status === 'scheduled' ? 'pending' : 'inactive'
                }`}>{p.status}</span>
              </td>
              <td className="px-4 py-3">{p.scheduledAt}</td>
              <td className="px-4 py-3">{p.reach}</td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  )
}
