import ClientTabs from '@/components/ClientTabs'
import LaunchesPage from '../test-launches/page'
import NewLaunchPage from '../test-launches/new/page'
import CampaignMonitorPage from '../campaign-monitor/page'
import RulesEditorPage from '../rules-editor/page'
import MediaRulesPage from '../media-rules/page'
import ActionCenterPage from '../action-center/page'
import TestingPage from './TestingPage'

const tabs = [
  { id: 'testing', label: 'Testing Lab' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'rules', label: 'Rules' },
]

// Legacy tab aliases — old bookmarks/links still work
const TAB_ALIAS: Record<string, string> = {
  launch: 'campaigns',
  monitor: 'campaigns',
  actions: 'rules',
}

export default async function AdsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; new?: string; sub?: string }>
}) {
  const { tab, new: isNew, sub } = await searchParams
  const resolved = tab ? (TAB_ALIAS[tab] ?? tab) : 'campaigns'
  const key = tabs.some(t => t.id === resolved) ? resolved : 'campaigns'

  // New campaign wizard — full page, no keep-alive needed
  if (key === 'campaigns' && isNew === '1') {
    return <NewLaunchPage />
  }

  const rulesInitial = sub === 'media' ? 'media' : sub === 'actions' ? 'actions' : 'campaign'

  return (
    <ClientTabs
      tabs={tabs}
      initial={key}
      basePath="/ads"
      panels={{
        testing: <TestingPage />,
        campaigns: (
          <div className="space-y-8">
            <LaunchesPage />
            <div className="border-t border-stone-100 pt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-4">Monitor Aktif</p>
              <CampaignMonitorPage />
            </div>
          </div>
        ),
        rules: (
          <ClientTabs
            compact
            tabs={[
              { id: 'campaign', label: 'Campaign Rules' },
              { id: 'media', label: 'Media Rules' },
              { id: 'actions', label: 'Actions' },
            ]}
            initial={rulesInitial}
            panels={{
              campaign: <RulesEditorPage />,
              media: <MediaRulesPage />,
              actions: <ActionCenterPage />,
            }}
          />
        ),
      }}
    />
  )
}
