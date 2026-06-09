import PageInfo from '@/components/ui/PageInfo'
import Table from '@/components/ui/Table'

const likers = [
  { id: '1', post: 'Taracare Body Lotion Promo', autoLike: true, autoHeart: true, target: 'all_followers', processed: '2026-06-09', count: 142 },
  { id: '2', post: 'Glazingskin UV Defense', autoLike: true, autoHeart: false, target: 'commenters_only', processed: '2026-06-08', count: 38 },
]

export default function AutoLikePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Auto Like</h1>
          <p className="section-sub">Automatically like or heart comments from engaged users.</p>
        </div>
        <a href="/community/auto-like/new" className="btn-primary">
          + New Rule
        </a>
      </div>

      <PageInfo
        purpose="Automatically react to comments from users who match certain criteria — followers, recent purchasers, or engaged commenters. Builds community goodwill."
        inputs={['Target users (followers/commenters/all)', 'Reaction type (like/heart)', 'Post selection', 'Active hours']}
      />

      <div className="card">
        <Table
          headers={['Post', 'Like', 'Heart', 'Target', 'Last Run', 'Count']}
        >
          {likers.map(l => (
            <tr key={l.id}>
              <td className="px-4 py-3"><span className="text-sm truncate max-w-[200px] block">{l.post}</span></td>
              <td className="px-4 py-3">{l.autoLike ? '✅' : '❌'}</td>
              <td className="px-4 py-3">{l.autoHeart ? '✅' : '❌'}</td>
              <td className="px-4 py-3">{l.target}</td>
              <td className="px-4 py-3">{l.processed}</td>
              <td className="px-4 py-3">{l.count}</td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  )
}
