import ClientTabs from '@/components/ClientTabs'
import LaunchesPage from '../test-launches/page'
import NewLaunchPage from '../test-launches/new/page'
import CampaignMonitorPage from '../campaign-monitor/page'
import RulesEditorPage from '../rules-editor/page'
import MediaRulesPage from '../media-rules/page'
import ActionCenterPage from '../action-center/page'

const tabs = [
  { id: 'launch', label: 'Launch' },
  { id: 'monitor', label: 'Monitor' },
  { id: 'rules', label: 'Rules' },
  { id: 'actions', label: 'Actions' },
]

export default async function AdsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; new?: string; sub?: string }>
}) {
  const { tab, new: isNew, sub } = await searchParams
  const key = tab && tabs.some(t => t.id === tab) ? tab : 'launch'

  // Wizard (new=1) tetap navigasi penuh — jarang & berat, gak perlu keep-alive
  if (key === 'launch' && isNew === '1') {
    return <NewLaunchPage />
  }

  return (
    <ClientTabs
      tabs={tabs}
      initial={key}
      basePath="/ads"
      panels={{
        launch: <LaunchesPage />,
        monitor: <CampaignMonitorPage />,
        rules: (
          <ClientTabs
            compact
            tabs={[
              { id: 'campaign', label: 'Campaign Rules' },
              { id: 'media', label: 'Media Rules' },
            ]}
            initial={sub === 'media' ? 'media' : 'campaign'}
            panels={{ campaign: <RulesEditorPage />, media: <MediaRulesPage /> }}
          />
        ),
        actions: <ActionCenterPage />,
      }}
    />
  )
}
