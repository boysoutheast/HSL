import TabLayout from '@/components/TabLayout'
import LaunchesPage from '../test-launches/page'
import NewLaunchPage from '../test-launches/new/page'
import CampaignMonitorPage from '../campaign-monitor/page'
import RulesEditorPage from '../rules-editor/page'
import MediaRulesPage from '../media-rules/page'
import ActionCenterPage from '../action-center/page'

const tabs = [
  { id: 'launch', label: 'Launch', href: '/ads?tab=launch' },
  { id: 'monitor', label: 'Monitor', href: '/ads?tab=monitor' },
  { id: 'rules', label: 'Rules', href: '/ads?tab=rules' },
  { id: 'actions', label: 'Actions', href: '/ads?tab=actions' },
]

export default async function AdsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; new?: string; sub?: string }>
}) {
  const { tab, new: isNew, sub } = await searchParams
  const key = tab || 'launch'

  return (
    <TabLayout tabs={tabs}>
      {key === 'launch' && (isNew === '1' ? <NewLaunchPage /> : <LaunchesPage />)}
      {key === 'monitor' && <CampaignMonitorPage />}
      {key === 'rules' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <a
              href="/ads?tab=rules"
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${!sub || sub === 'rules' ? 'bg-violet-100 text-violet-700' : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50'}`}
            >
              Campaign Rules
            </a>
            <a
              href="/ads?tab=rules&sub=media"
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${sub === 'media' ? 'bg-violet-100 text-violet-700' : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50'}`}
            >
              Media Rules
            </a>
          </div>
          {sub === 'media' ? <MediaRulesPage /> : <RulesEditorPage />}
        </div>
      )}
      {key === 'actions' && <ActionCenterPage />}
    </TabLayout>
  )
}
