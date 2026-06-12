import Link from 'next/link'
import TabLayout from '@/components/TabLayout'

const tabs = [
  { id: 'launch', label: 'Launch', href: '/ads?tab=launch' },
  { id: 'monitor', label: 'Monitor', href: '/ads?tab=monitor' },
  { id: 'rules', label: 'Rules', href: '/ads?tab=rules' },
  { id: 'actions', label: 'Actions', href: '/ads?tab=actions' },
]

const panels: Record<string, { title: string; desc: string; links: Array<{ label: string; href: string }> }> = {
  launch: {
    title: 'Launches',
    desc: 'Label baru untuk Test Launches. Flow existing tetap dipakai.',
    links: [
      { label: 'Buka Launches', href: '/test-launches' },
      { label: 'New Launch', href: '/test-launches/new' },
    ],
  },
  monitor: {
    title: 'Campaign Monitor',
    desc: 'Monitor existing dipakai apa adanya.',
    links: [{ label: 'Buka Monitor', href: '/campaign-monitor' }],
  },
  rules: {
    title: 'Rules',
    desc: 'Rules Editor + Media Rules pindah ke pilar Ads.',
    links: [
      { label: 'Rules Editor', href: '/rules-editor' },
      { label: 'Media Rules', href: '/media-rules' },
    ],
  },
  actions: {
    title: 'Action Center',
    desc: 'Action Center existing dipakai apa adanya.',
    links: [{ label: 'Buka Actions', href: '/action-center' }],
  },
}

export default async function AdsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  const key = tab && panels[tab] ? tab : 'launch'
  const panel = panels[key]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Ads</h1>
        <p className="text-sm text-stone-500 mt-1">5 pilar IA — phase 1 alias hub. Route lama tetap hidup.</p>
      </div>
      <TabLayout tabs={tabs}>
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">{panel.title}</h2>
            <p className="text-sm text-stone-500 mt-1">{panel.desc}</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {panel.links.map((link) => (
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
