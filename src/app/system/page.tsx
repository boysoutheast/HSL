import ClientTabs from '@/components/ClientTabs'
import MetaConnectionsPage from '../meta-connections/page'
import AgentsPage from '../agents/page'
import WorkersPage from '../workers/page'
import DeadLettersPage from '../admin/dead-letters/page'
import ObservabilityPage from '../observability/page'
import AdminUsersPage from '../admin-users/page'
import DocsPage from '../docs/page'

const tabs = [
  { id: 'connections', label: 'Connections' },
  { id: 'agents', label: 'Agents' },
  { id: 'workers', label: 'Workers' },
  { id: 'users', label: 'Users' },
  { id: 'docs', label: 'Docs' },
]

export default async function SystemPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; sub?: string }>
}) {
  const { tab, sub } = await searchParams
  const key = tab && tabs.some(t => t.id === tab) ? tab : 'connections'

  return (
    <ClientTabs
      tabs={tabs}
      initial={key}
      basePath="/system"
      panels={{
        connections: <MetaConnectionsPage />,
        agents: <AgentsPage />,
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
        docs: <DocsPage />,
      }}
    />
  )
}
