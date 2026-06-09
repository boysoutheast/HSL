import PageInfo from '@/components/ui/PageInfo'
import Table from '@/components/ui/Table'

const drafts = [
  { id: '1', title: 'TaraCare Calming Cream Review', platform: 'Facebook', lastEdited: '2026-06-08 14:22', preview: 'Kulit kering? Ini solusinya...' },
  { id: '2', title: 'Summer Skin Care Tips', platform: 'Instagram', lastEdited: '2026-06-07 09:11', preview: 'UV protection yang ringan...' },
  { id: '3', title: 'Customer Story: Mbak Rina', platform: 'Facebook', lastEdited: '2026-06-06 16:45', preview: 'Setelah 2 minggu pakai TaraCare...' },
]

export default function DraftsPage() {
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
        <Table
          headers={['Title', 'Platform', 'Last Edited', 'Preview']}
        >
          {drafts.map(d => (
            <tr key={d.id}>
              <td className="px-4 py-3"><a href={`/posts/drafts/${d.id}`} className="text-violet-700 hover:underline">{d.title}</a></td>
              <td className="px-4 py-3">{d.platform}</td>
              <td className="px-4 py-3">{d.lastEdited}</td>
              <td className="px-4 py-3"><span className="text-stone-500 text-sm truncate max-w-xs block">{d.preview}</span></td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  )
}
