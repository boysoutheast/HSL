import Link from 'next/link'
import TabLayout from '@/components/TabLayout'

const tabs = [
  { id: 'connections', label: 'Connections', href: '/system?tab=connections' },
  { id: 'agents', label: 'Agents', href: '/system?tab=agents' },
  { id: 'workers', label: 'Workers', href: '/system?tab=workers' },
  { id: 'users', label: 'Users', href: '/system?tab=users' },
  { id: 'docs', label: 'Docs', href: '/system?tab=docs' },
]

export default async function SystemPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  const key = tab || 'connections'
  const map: Record<string, { label: string; hrefs: Array<{ label: string; href: string }> }> = {
    connections: { label: 'Connections', hrefs: [{ label: 'Meta Connections', href: '/meta-connections' }] },
    agents: { label: 'Agents', hrefs: [{ label: 'Agents', href: '/agents' }] },
    workers: { label: 'Workers', hrefs: [{ label: 'Workers', href: '/workers' }, { label: 'Dead Letters', href: '/admin/dead-letters' }, { label: 'Observability', href: '/observability' }] },
    users: { label: 'Users', hrefs: [{ label: 'Admin Users', href: '/admin-users' }] },
    docs: { label: 'Docs', hrefs: [{ label: 'Docs', href: '/docs' }] },
  }
  const panel = map[key] || map.connections

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">System</h1>
        <p className="text-sm text-stone-500 mt-1">Connections, workers, users, docs.</p>
      </div>
      <TabLayout tabs={tabs}>
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-stone-900">{panel.label}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {panel.hrefs.map((link) => (
              <Link key={link.href} href={link.href} className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-medium text-stone-700 hover:bg-white hover:border-violet-200">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </TabLayout>
    </div>
  )
}
