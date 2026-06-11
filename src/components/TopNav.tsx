'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemeToggle from './ThemeToggle'

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
    label: 'Accounts',
    href: '/accounts',
    items: [
      { label: 'Connected Accounts', href: '/accounts' },
      { label: 'Characters', href: '/characters' },
      { label: 'Topics & CEPs', href: '/topics' },
      { label: 'Products', href: '/products' },
      { label: 'Media Library', href: '/media-library' },
      { label: 'Meta Connections', href: '/meta-connections' },
    ],
  },
  {
    label: 'Launches',
    href: '/test-launches',
    items: [
      { label: 'All Launches', href: '/test-launches' },
      { label: 'New Launch', href: '/test-launches/new' },
      { label: 'Campaign Monitor', href: '/campaign-monitor' },
      { label: 'Action Center', href: '/action-center' },
      { label: 'Rules', href: '/rules-editor' },
      { label: 'Approvals', href: '/approval-requests', adminOnly: true },
    ],
  },
  {
    label: 'Admin',
    href: '/admin-users',
    adminOnly: true,
    items: [
      { label: 'Users', href: '/admin-users', adminOnly: true },
      { label: 'Agents', href: '/agents', adminOnly: true },
      { label: 'Dead Letters', href: '/admin/dead-letters', adminOnly: true },
      { label: 'Observability', href: '/observability', adminOnly: true },
      { label: 'API Docs', href: '/docs' },
      { label: 'Settings', href: '/settings', adminOnly: true },
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
    <header className="sticky top-0 z-40 bg-white dark:bg-stone-900 border-b-2 border-stone-300 dark:border-stone-700 shadow-sm">
      {/* ── Top bar (classic tab nav) ── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-11 items-center justify-between gap-2">

          {/* Brand */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-base font-bold tracking-tight text-stone-900 dark:text-stone-50">Hermes</span>
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
                      ? 'text-stone-900 dark:text-stone-50 border-b-2 border-stone-900 dark:border-violet-400 -mb-px'
                      : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 border-b-2 border-transparent'
                  }`}
                >
                  {group.label}
                </Link>
              )
            })}
          </nav>

          {/* User + logout */}
          <div className="flex items-center gap-2 shrink-0">
            {user && (
              <div className="hidden text-right sm:block">
                <p className="text-xs font-semibold text-stone-700 dark:text-stone-200">{user.name ?? user.email}</p>
                <p className="text-[11px] text-stone-400 dark:text-stone-500">{user.role === 'admin' ? 'Admin' : 'User'}</p>
              </div>
            )}
            <ThemeToggle />
            {onLogout && (
              <button onClick={onLogout} className="btn-ghost btn-sm">
                Logout
              </button>
            )}
          </div>
        </div>

        {/* ── Sub-nav bar ── */}
        {subItems.length > 0 && (
          <div className="flex h-9 items-center gap-1 border-t border-stone-100 dark:border-stone-800 -mb-px">
            {subItems.map(item => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center h-full px-3 text-xs font-medium border-b transition-colors ${
                    active
                      ? 'text-stone-900 dark:text-stone-50 border-stone-900 dark:border-violet-400'
                      : 'text-stone-400 dark:text-stone-500 border-transparent hover:text-stone-700 dark:hover:text-stone-200'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </header>
  )
}