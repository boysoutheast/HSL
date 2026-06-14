import ClientTabs from '@/components/ClientTabs'
import WorkersPage from '../workers/page'
import DeadLettersPage from '../admin/dead-letters/page'
import ObservabilityPage from '../observability/page'
import AdminUsersPage from '../admin-users/page'

const tabs = [
  { id: 'workers', label: 'Workers' },
  { id: 'users', label: 'Users' },
]

export default async function SystemPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; sub?: string }>
}) {
  const { tab, sub } = await searchParams
  const key = tab && tabs.some(t => t.id === tab) ? tab : 'workers'

  return (
    <ClientTabs
      tabs={tabs}
      initial={key}
      basePath="/system"
      panels={{
        workers: (
          <ClientTabs
            compact
            tabs={[
              { id: 'tasks', label: 'Workers & Tasks' },
              { id: 'dead-letters', label: 'Dead Letters' },
              { id: 'observability', label: 'Observability' },
            ]}
            initial={sub === 'dead-letters' ? 'dead-letters' : sub === 'observability' ? 'observability' : 'tasks'}
            panels={{
              tasks: <WorkersPage />,
              'dead-letters': <DeadLettersPage />,
              observability: <ObservabilityPage />,
            }}
          />
        ),
        users: <AdminUsersPage />,
      }}
    />
  )
}
