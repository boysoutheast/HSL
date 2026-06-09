'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface User {
  id: string
  name: string | null
  email: string
  role: 'admin' | 'user'
}

interface NavGroup {
  label: string
  href: string
  icon: string
  items: Array<{ label: string; href: string; adminOnly?: boolean }>
  adminOnly?: boolean
}

const navGroups: NavGroup[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: '📊',
    items: [
      { label: 'Overview', href: '/' },
      { label: 'Ready Upload', href: '/monitor' },
      { label: 'Performance', href: '/performance' },
      { label: 'Logs', href: '/logs' },
    ],
  },
  {
    label: 'Meta',
    href: '/meta-connections',
    icon: '🔗',
    items: [
      { label: 'Meta Connections', href: '/meta-connections' },
      { label: 'Accounts', href: '/accounts' },
      { label: 'Products', href: '/products' },
      { label: 'Photos', href: '/photos' },
    ],
  },
  {
    label: 'Launches',
    href: '/test-launches',
    icon: '🚀',
    items: [
      { label: 'All Launches', href: '/test-launches' },
      { label: 'New Launch', href: '/test-launches/new' },
      { label: 'Approvals', href: '/approval-requests', adminOnly: true },
    ],
  },
  {
    label: 'Approvals',
    href: '/approval-requests',
    icon: '✅',
    adminOnly: true,
    items: [
      { label: 'Pending', href: '/approval-requests', adminOnly: true },
      { label: 'Users', href: '/admin-users', adminOnly: true },
    ],
  },
  {
    label: 'Worker',
    href: '/agents',
    icon: '🤖',
    items: [
      { label: 'Agents', href: '/agents', adminOnly: true },
      { label: 'Settings', href: '/settings', adminOnly: true },
      { label: 'API Docs', href: '/docs' },
    ],
  },
]

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

export default function TopNav({ user, onLogout }: { user?: User | null; onLogout?: () => void }) {
  const pathname = usePathname()
  const isAdmin = user?.role === 'admin'

  const visibleGroups = navGroups.filter(group => !group.adminOnly || isAdmin)
  const activeGroup = visibleGroups.find(group => isActive(pathname, group.href)) ?? visibleGroups[0]
  const subItems = activeGroup.items.filter(item => !item.adminOnly || isAdmin)

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-gray-900">Hermes</span>
                <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">HSL</span>
              </div>
              <p className="text-xs text-gray-500">Support Library</p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            {visibleGroups.map(group => {
              const active = activeGroup.label === group.label
              return (
                <Link
                  key={group.label}
                  href={group.href}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                    active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span>{group.icon}</span>
                  <span>{group.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2">
            {user && (
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-gray-900">{user.name ?? user.email}</p>
                <p className="text-xs text-gray-500">{user.role === 'admin' ? 'Admin' : 'User'}</p>
              </div>
            )}
            {onLogout && (
              <button onClick={onLogout} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Logout
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
          {subItems.map(item => {
            const active = isActive(pathname, item.href)
            const external = item.href.startsWith('http') || item.href === '/docs'
            const cls = `rounded-lg px-3 py-1.5 text-sm transition ${active ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-gray-600 hover:bg-gray-100'}`
            return external ? (
              <a key={item.href} href={item.href} target="_blank" rel="noreferrer" className={cls}>
                {item.label}
              </a>
            ) : (
              <Link key={item.href} href={item.href} className={cls}>
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>
    </header>
  )
}
