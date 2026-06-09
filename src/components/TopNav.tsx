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
  items: Array<{ label: string; href: string; adminOnly?: boolean }>
  adminOnly?: boolean
}

const navGroups: NavGroup[] = [
  {
    label: 'Dashboard',
    href: '/',
    items: [
      { label: 'Overview', href: '/' },
      { label: 'Monitor', href: '/monitor' },
      { label: 'Logs', href: '/logs' },
    ],
  },
  {
    label: 'Meta',
    href: '/meta-connections',
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
    items: [
      { label: 'All Launches', href: '/test-launches' },
      { label: 'New Launch', href: '/test-launches/new' },
      { label: 'Approvals', href: '/approval-requests', adminOnly: true },
    ],
  },
  {
    label: 'Approvals',
    href: '/approval-requests',
    adminOnly: true,
    items: [
      { label: 'Pending', href: '/approval-requests', adminOnly: true },
      { label: 'Users', href: '/admin-users', adminOnly: true },
    ],
  },
  {
    label: 'Worker',
    href: '/agents',
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
    <header className="sticky top-0 z-40 bg-white border-b-2 border-stone-300 shadow-sm">
      {/* ── Top bar (classic tab nav) ── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-11 items-center justify-between gap-2">

          {/* Brand */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-base font-bold tracking-tight text-stone-900">Hermes</span>
            <span className="bg-violet-700 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">HSL</span>
          </div>

          {/* Primary nav — classic underline tabs */}
          <nav className="flex items-center h-full">
            {visibleGroups.map(group => {
              const active = activeGroup.label === group.label
              return (
                <Link
                  key={group.label}
                  href={group.href}
                  className={`relative h-full flex items-center px-4 text-sm font-medium transition-colors ${
                    active
                      ? 'text-stone-900 border-b-2 border-stone-900 -mb-px'
                      : 'text-stone-500 hover:text-stone-800 border-b-2 border-transparent hover:-mb-px'
                  }`}
                >
                  {group.label}
                </Link>
              )
            })}
          </nav>

          {/* User + logout */}
          <div className="flex items-center gap-3 shrink-0">
            {user && (
              <div className="hidden text-right sm:block">
                <p className="text-xs font-semibold text-stone-700">{user.name ?? user.email}</p>
                <p className="text-[11px] text-stone-400">{user.role === 'admin' ? 'Admin' : 'User'}</p>
              </div>
            )}
            {onLogout && (
              <button onClick={onLogout} className="btn-ghost btn-sm">
                Logout
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Sub nav (classic secondary tabs) ── */}
      <div className="bg-stone-100 border-t border-stone-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center gap-0">
            {subItems.map(item => {
              const active = isActive(pathname, item.href)
              const external = item.href.startsWith('http') || item.href === '/docs'
              const cls = `inline-block px-4 py-2 text-sm border-b-2 transition-colors ${
                active
                  ? 'border-stone-600 text-stone-900 font-medium bg-white -mb-px'
                  : 'border-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-200'
              }`
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
      </div>
    </header>
  )
}