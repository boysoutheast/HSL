import ClientTabs from '@/components/ClientTabs'
import InfluencerRoster from '@/components/InfluencerRoster'
import TopicsPage from '../topics/page'

const tabs = [
  { id: 'roster', label: 'Roster' },
  { id: 'topics', label: 'Semua Topik' },
  { id: 'generate', label: 'Content Engine' },
]

export default async function InfluencerPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  const key = tab && tabs.some(t => t.id === tab) ? tab : 'roster'

  return (
    <ClientTabs
      tabs={tabs}
      initial={key}
      basePath="/influencer"
      panels={{
        roster: <InfluencerRoster />,
        topics: <TopicsPage />,
        generate: (
          <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center">
            <p className="text-2xl mb-2">✦</p>
            <p className="text-sm font-semibold text-stone-700 mb-1">Content Engine</p>
            <p className="text-sm text-stone-400">
              Auto-topic → auto-generate → antrian posting per influencer — coming soon.
            </p>
          </div>
        ),
      }}
    />
  )
}
