import Link from 'next/link'
import TabLayout from '@/components/TabLayout'

const tabs = [
  { id: 'roster', label: 'Roster', href: '/influencer?tab=roster' },
  { id: 'topics', label: 'Semua Topik', href: '/influencer?tab=topics' },
  { id: 'generate', label: 'Content Engine', href: '/influencer?tab=generate' },
]

export default async function InfluencerPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  const key = tab || 'roster'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Influencer</h1>
        <p className="text-sm text-stone-500 mt-1">Instagram accounts, topics, dan persona.</p>
      </div>
      <TabLayout tabs={tabs}>
        {key === 'roster' && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-4">
            <Link href="/accounts" className="inline-flex px-4 py-2 text-sm font-medium bg-stone-50 border border-stone-200 rounded-lg hover:bg-white hover:border-violet-200">Buka Roster IG Accounts</Link>
          </div>
        )}
        {key === 'topics' && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-4">
            <Link href="/topics" className="inline-flex px-4 py-2 text-sm font-medium bg-stone-50 border border-stone-200 rounded-lg hover:bg-white hover:border-violet-200">Buka Topics &amp; CEPs</Link>
          </div>
        )}
        {key === 'generate' && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-4">
            <p className="text-sm text-stone-400">Content Engine — coming soon.</p>
          </div>
        )}
      </TabLayout>
    </div>
  )
}
