import TabLayout from '@/components/TabLayout'
import MetaConnectionsPage from '../meta-connections/page'
import AgentsPage from '../agents/page'
import WorkersPage from '../workers/page'
import DeadLettersPage from '../admin/dead-letters/page'
import ObservabilityPage from '../observability/page'
import AdminUsersPage from '../admin-users/page'
import DocsPage from '../docs/page'

const tabs = [
  { id: 'connections', label: 'Connections', href: '/system?tab=connections' },
  { id: 'agents', label: 'Agents', href: '/system?tab=agents' },
  { id: 'workers', label: 'Workers', href: '/system?tab=workers' },
  { id: 'users', label: 'Users', href: '/system?tab=users' },
  { id: 'docs', label: 'Docs', href: '/system?tab=docs' },
]

const workerSubs = [
  { id: 'tasks', label: 'Workers & Tasks' },
  { id: 'dead-letters', label: 'Dead Letters' },
  { id: 'observability', label: 'Observability' },
]

export default async function SystemPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; sub?: string }>
}) {
  const { tab, sub } = await searchParams
  const key = tab || 'connections'
  const workerSub = sub || 'tasks'

  return (
    <TabLayout tabs={tabs}>
      {key === 'connections' && <MetaConnectionsPage />}
      {key === 'agents' && <AgentsPage />}
      {key === 'workers' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {workerSubs.map((s) => (
              <a
                key={s.id}
                href={`/system?tab=workers&sub=${s.id}`}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${workerSub === s.id ? 'bg-violet-100 text-violet-700' : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50'}`}
              >
                {s.label}
              </a>
            ))}
          </div>
          {workerSub === 'tasks' && <WorkersPage />}
          {workerSub === 'dead-letters' && <DeadLettersPage />}
          {workerSub === 'observability' && <ObservabilityPage />}
        </div>
      )}
      {key === 'users' && <AdminUsersPage />}
      {key === 'docs' && <DocsPage />}
    </TabLayout>
  )
}
