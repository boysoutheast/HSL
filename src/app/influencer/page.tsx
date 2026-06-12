import TabLayout from '@/components/TabLayout'
import AccountsPage from '../accounts/page'
import TopicsPage from '../topics/page'

const tabs = [
  { id: 'roster', label: 'Roster', href: '/influencer?tab=roster' },
  { id: 'topics', label: 'Semua Topik', href: '/influencer?tab=topics' },
  { id: 'generate', label: 'Content Engine', href: '/influencer?tab=generate' },
]

export default async function InfluencerPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  const key = tab || 'roster'

  return (
    <TabLayout tabs={tabs}>
      {key === 'roster' && <AccountsPage />}
      {key === 'topics' && <TopicsPage />}
      {key === 'generate' && (
        <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center">
          <p className="text-2xl mb-2">✦</p>
          <p className="text-sm font-semibold text-stone-700 mb-1">Content Engine</p>
          <p className="text-sm text-stone-400">
            Auto-topic → auto-generate → antrian posting per influencer — coming soon.
          </p>
        </div>
      )}
    </TabLayout>
  )
}
