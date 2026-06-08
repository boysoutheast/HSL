'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  icon: string
  external?: boolean
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/monitor', label: 'Ready Upload', icon: '🎯' },
  { href: '/accounts', label: 'Accounts', icon: '📱' },
  { href: '/admin-users', label: 'Users', icon: '👥', adminOnly: true },
  { href: '/products', label: 'Products', icon: '🛍️' },
  { href: '/meta-connections', label: 'Meta Akun', icon: '🔗' },
  { href: '/test-launches', label: 'Test Launcher', icon: '🚀' },
  { href: '/approval-requests', label: 'Approvals', icon: '✅', adminOnly: true },
  { href: '/agents', label: 'Agents', icon: '🤖', adminOnly: true },
  { href: '/logs', label: 'Logs', icon: '📋' },
  { href: '/settings', label: 'Settings', icon: '⚙️', adminOnly: true },
  { href: '/docs', label: 'API Docs', icon: '📖', external: true },
]

interface SidebarUser {
  id: string
  name: string | null
  email: string
  role: 'admin' | 'user'
}

export default function Sidebar({
  onLogout,
  user,
}: {
  onLogout?: () => void
  user?: SidebarUser | null
}) {
  const pathname = usePathname()
  const isAdmin = user?.role === 'admin'

  return (
    <nav className="w-56 flex-shrink-0 bg-gray-900 text-white flex flex-col h-full overflow-y-auto">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-white">Hermes</span>
          <span className="text-xs bg-indigo-600 text-white px-1.5 py-0.5 rounded font-medium">
            {isAdmin ? 'Admin' : 'App'}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">Support Library</p>
      </div>

      {/* Nav links */}
      <ul className="flex-1 py-3 space-y-0.5 px-2">
        {navItems
          .filter(item => !item.adminOnly || isAdmin)
          .map(({ href, label, icon, external }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
            const className = `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive
                ? 'bg-indigo-600 text-white font-medium'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`
            const content = (
              <>
                <span className="text-base w-4 text-center leading-none">{icon}</span>
                {label}
                {external && <span className="ml-auto text-xs opacity-50">↗</span>}
              </>
            )
            return (
              <li key={href}>
                {external ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
                    {content}
                  </a>
                ) : (
                  <Link href={href} className={className}>
                    {content}
                  </Link>
                )}
              </li>
            )
          })}
      </ul>

      {/* User info + logout */}
      <div className="px-3 py-4 border-t border-gray-800">
        {user && (
          <div className="flex items-center gap-2 px-1 py-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {(user.name ?? user.email)[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white font-medium truncate">{user.name ?? user.email}</p>
              <span
                className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  user.role === 'admin'
                    ? 'bg-yellow-900/50 text-yellow-400'
                    : 'bg-gray-800 text-gray-400'
                }`}
              >
                {user.role === 'admin' ? '👑 Admin' : '👤 User'}
              </span>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                className="text-gray-500 hover:text-red-400 text-lg transition-colors flex-shrink-0"
                title="Logout"
              >
                ↩
              </button>
            )}
          </div>
        )}
        {!user && onLogout && (
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-red-900/40 hover:text-red-300 transition-colors mb-2"
          >
            <span className="text-base w-4 text-center">🚪</span>
            Logout
          </button>
        )}
        <p className="text-xs text-gray-700 px-1">v1.0.0</p>
      </div>
    </nav>
  )
}
